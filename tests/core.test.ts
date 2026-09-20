import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foam } from '../src/core.js';
import type { InferenceAdapter, FoamOptions } from '../src/types.js';
import { fixtureInference, cues } from '../examples/fixture.js';

const identity: InferenceAdapter = { async infer(input) { return { markdown: input.memory.markdown, context: '' }; } };
async function setup(t: { after(fn: () => Promise<void>): void }, inference = identity, extra: Partial<FoamOptions> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'foam-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, foam: new Foam({ directory, scope: 'test', inference, ...extra }) };
}
const encounter = { cue: 'repair', occurrence: 'one' };

test('empty, restart, inspection and distinct repeated encounters', async t => {
  const { directory, foam } = await setup(t);
  assert.deepEqual(await foam.inspect(), { scope: 'test', revision: 0, markdown: '' });
  const a = await foam.prepare(encounter);
  const b = await foam.prepare(encounter);
  assert.notEqual(a.access.id, b.access.id);
  assert.equal(b.revision, 2);
  assert.equal((await foam.inspect()).revision, 2);
  assert.deepEqual(await new Foam({ directory, scope: 'test', inference: identity }).inspect(), await foam.inspect());
});

test('interruption, completion and old cues preserve unrelated activity', async t => {
  const { foam } = await setup(t, fixtureInference);
  const results = [];
  for (const [i, cue] of cues.entries()) results.push(await foam.prepare({ cue, occurrence: String(i) }));
  assert.match(results[2]!.context, /waiting/);
  assert.match(results[4]!.context, /complete/);
  assert.doesNotMatch(results[4]!.context, /waiting/);
  assert.match((await foam.inspect()).markdown, /## Travel/);
});

test('access and actual supplied context can change memory', async t => {
  const { foam } = await setup(t, { async infer(input) {
    return { markdown: 'access' in input.encounter ? 'Revisited under a new goal.' : 'Waiting for repair.', context: 'Repair episode' };
  } });
  const a = await foam.prepare(encounter);
  await foam.observe({ ...encounter, observations: ['We are reviewing past repairs.'], access: a.access, suppliedContext: a.context });
  assert.equal((await foam.inspect()).markdown, 'Revisited under a new goal.');
});

test('scope isolation rejects a differently labelled directory and access', async t => {
  const { directory, foam } = await setup(t);
  const first = await foam.prepare(encounter);
  const other = new Foam({ directory, scope: 'other', inference: identity });
  await assert.rejects(other.inspect(), /scope mismatch/);
  await assert.rejects(foam.observe({ ...encounter, observations: [], access: { ...first.access, scope: 'other' } }), /cross-scope/);
  const { foam: isolated } = await setup(t);
  assert.equal((await isolated.inspect()).revision, 0);
});

test('all invalid proposals and inference failures preserve bytes and release lock', async t => {
  const { directory, foam } = await setup(t);
  await foam.prepare(encounter);
  const original = await readFile(join(directory, 'memory.md'), 'utf8');
  for (const output of [null, [], {}, { markdown: '', context: 4 }, { markdown: '', context: '', extra: true }, { markdown: 'x'.repeat(13000), context: '' }, { markdown: '', context: '😀'.repeat(600) }]) {
    const bad = new Foam({ directory, scope: 'test', inference: { async infer() { return output; } } });
    await assert.rejects(bad.prepare(encounter));
    assert.equal(await readFile(join(directory, 'memory.md'), 'utf8'), original);
  }
  const bad = new Foam({ directory, scope: 'test', inference: { async infer() { throw new Error('backend down'); } } });
  await assert.rejects(bad.prepare(encounter), /backend down/);
  assert.equal(await readFile(join(directory, 'memory.md'), 'utf8'), original);
  await foam.prepare(encounter);
});

test('analysis and tokenizer budgets are enforced before inference', async t => {
  let calls = 0;
  const inference = { async infer() { calls++; return { markdown: '', context: '' }; } };
  const { foam } = await setup(t, inference, { maxInputBytes: 100 });
  await assert.rejects(foam.prepare(encounter), /byte budget/);
  const { foam: tokens } = await setup(t, inference, { countTokens: () => 101, maxInputTokens: 100 });
  await assert.rejects(tokens.prepare(encounter), /token budget/);
  assert.equal(calls, 0);
});

test('timeout aborts adapter and late resolution cannot commit', async t => {
  let aborted = false;
  const { directory, foam } = await setup(t, { async infer(_input, signal) {
    signal.addEventListener('abort', () => { aborted = true; });
    await new Promise(resolve => setTimeout(resolve, 40));
    return { markdown: 'late', context: '' };
  } }, { timeoutMs: 5 });
  await assert.rejects(foam.prepare(encounter), /timeout/);
  assert.equal(aborted, true);
  await new Foam({ directory, scope: 'test', inference: identity }).prepare(encounter);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal((await foam.inspect()).markdown, '');
});

test('writer lock rejects contention and expected revision rejects stale checkpoints', async t => {
  let release!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const { directory, foam } = await setup(t, { async infer() { entered(); await wait; return { markdown: 'committed', context: '' }; } });
  const writing = foam.prepare(encounter);
  await ready;
  const second = new Foam({ directory, scope: 'test', inference: identity });
  await assert.rejects(second.prepare(encounter), /writer lock/);
  release();
  await writing;
  await assert.rejects(second.prepare({ ...encounter, expectedRevision: 0 }), /Revision conflict/);
  assert.equal((await second.inspect()).markdown, 'committed');
});

test('manual edits during inference are detected by content hash', async t => {
  const { directory, foam } = await setup(t);
  await foam.prepare(encounter);
  const path = join(directory, 'memory.md');
  const raw = await readFile(path, 'utf8');
  const mutating = new Foam({ directory, scope: 'test', inference: { async infer() {
    await writeFile(path, raw + 'manual edit');
    return { markdown: 'model edit', context: '' };
  } } });
  await assert.rejects(mutating.prepare(encounter), /changed during/);
  assert.equal(await readFile(path, 'utf8'), raw + 'manual edit');
});

test('malformed, oversized and symlink scratchpads fail without replacing data', async t => {
  const { directory, foam } = await setup(t);
  const path = join(directory, 'memory.md');
  for (const raw of ['bad frontmatter', 'x'.repeat(30000), '---\nscope: "test"\nrevision: 0\n---\n']) {
    await writeFile(path, raw);
    await assert.rejects(foam.prepare(encounter));
    assert.equal(await readFile(path, 'utf8'), raw);
  }
  await rm(path);
  const target = join(directory, 'outside.md');
  await writeFile(target, 'untouched');
  await symlink(target, path);
  await assert.rejects(foam.prepare(encounter));
  assert.equal(await readFile(target, 'utf8'), 'untouched');
});
