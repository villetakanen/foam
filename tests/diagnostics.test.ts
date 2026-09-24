import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foam } from '../src/index.js';
import type { DiagnosticRecord } from '../src/index.js';

test('diagnostics correlate prepare, reported supply and observation with bounded read-only traces', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-diagnostics-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const records: DiagnosticRecord[] = [];
  let fail = false;
  const foam = new Foam({ directory, scope: 'private', trace: { maxBytes: 4000, maxRecords: 3 }, diagnosticDetails: true,
    diagnostics: record => { records.push(record); }, inference: { async infer() {
      if (fail) throw new Error('observation unavailable');
      return { markdown: 'Radiator.', context: 'Known radiator.' };
    } } });
  const prepared = await foam.prepare({ cue: 'radiator', occurrence: 'one', correlationId: 'request-1',
    recentExchange: [{ role: 'user', text: 'Water radiator, width 620 mm.' }] });
  fail = true;
  await assert.rejects(foam.observe({ cue: 'update', occurrence: 'one', correlationId: 'request-1',
    access: prepared.access, suppliedContext: prepared.context, observations: ['No tool executed.'] }), /unavailable/);
  assert.deepEqual(records.map(r => [r.phase, r.outcome]), [['prepare', 'committed'], ['supply', 'supplied'], ['observe', 'failed']]);
  assert.equal(records[1]!.operationId, prepared.access.id);
  assert.equal(records[2]!.beforeRevision, 1);
  assert.equal((await foam.inspect()).revision, 1);
  fail = false;
  for (let i = 0; i < 6; i++) await foam.prepare({ cue: 'radiator', occurrence: String(i) });
  const status = await foam.status();
  assert.equal(status.trace.length, 3);
  assert.ok((await readFile(join(directory, 'trace.json'))).length <= 4000);
  assert.equal((await foam.inspect()).revision, 7);
  assert.equal(status.trace.at(-1)!.details!.after, 'Radiator.');
});

test('diagnostic failures report loss without turning a committed operation into failure', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-loss-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'private', trace: { maxBytes: 20, maxRecords: 1 },
    diagnostics: () => { throw new Error('audit offline'); }, inference: { async infer() { return { markdown: 'Known.', context: '' }; } } });
  const result = await foam.prepare({ cue: 'one', occurrence: 'one' });
  assert.equal(result.revision, 1);
  assert.equal(result.diagnosticLoss!.length, 2);
  assert.match(result.diagnosticLoss![0]!, /audit offline/);
  assert.equal((await foam.inspect()).revision, 1);
});

test('exchange and correlation bounds reject before inference', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-exchange-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'private', inference: { async infer() { assert.fail('Must not infer'); } } });
  for (const recentExchange of [[{ role: 'user' as const, text: 'x'.repeat(8193) }], Array.from({ length: 33 }, () => ({ role: 'user' as const, text: 'x' }))]) {
    await assert.rejects(foam.prepare({ cue: 'one', occurrence: 'one', recentExchange }), /recent exchange/);
  }
  await assert.rejects(foam.prepare({ cue: 'one', occurrence: 'one', correlationId: 'x'.repeat(257) }), /correlation/);
});

test('token admission accounts for the output reserve', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-token-reserve-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'private', countTokens: () => 900, maxTotalTokens: 1000, outputTokenReserve: 200,
    inference: { async infer() { assert.fail('Reserve must be admitted before inference'); } } });
  await assert.rejects(foam.prepare({ cue: 'x', occurrence: 'x' }), /output reserve/);
  assert.equal((await foam.inspect()).revision, 0);
});

test('non-Error diagnostic rejections cannot disguise a successful commit', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-nonerror-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'private', diagnostics: async () => { throw null; },
    inference: { async infer() { return { markdown: 'Committed.', context: '' }; } } });
  const result = await foam.prepare({ cue: 'x', occurrence: 'x' });
  assert.equal(result.revision, 1);
  assert.match(result.diagnosticLoss![0]!, /null/);
});

test('inspection exposes committed memory even when trace history is corrupt', async t => {
  const { writeFile } = await import('node:fs/promises');
  const directory = await mkdtemp(join(tmpdir(), 'foam-corrupt-trace-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'private', trace: { maxBytes: 4096, maxRecords: 10 },
    inference: { async infer() { return { markdown: 'Known snapshot.', context: '' }; } } });
  await foam.prepare({ cue: 'x', occurrence: 'x' });
  await writeFile(join(directory, 'trace.json'), '{');
  const status = await foam.status();
  assert.equal(status.snapshot.markdown, 'Known snapshot.');
  assert.equal(status.trace.length, 0);
  assert.match(status.diagnosticLoss[0]!, /unreadable/);
});
