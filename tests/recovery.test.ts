import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Foam } from '../src/index.js';
const inference = { async infer() { return { markdown: 'Old complete snapshot.', context: '' }; } };

for (const stage of ['inference', 'before-rename', 'after-rename', 'before-delivery']) {
  test(`subprocess termination at ${stage} preserves a complete snapshot and recovers explicitly`, { timeout: 15000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'foam-crash-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const foam = new Foam({ directory, scope: 'private', inference });
    await foam.prepare({ cue: 'old', occurrence: 'old' });
    const child = fork(fileURLToPath(new URL('./fixtures/crash-writer.ts', import.meta.url)), [directory, stage], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    t.after(() => { child.kill('SIGKILL'); });
    const message = await Promise.race([once(child, 'message'), once(child, 'exit').then(code => { throw new Error(`Child exited before boundary: ${code}`); })]);
    assert.equal(message[0], stage);
    await assert.rejects(foam.recover(), /Live owner/);
    await assert.rejects(foam.prepare({ cue: 'contender', occurrence: 'contender' }), /busy/);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    const snapshot = await foam.inspect();
    assert.equal(snapshot.revision, ['after-rename', 'before-delivery'].includes(stage) ? 2 : 1);
    assert.equal(snapshot.markdown, snapshot.revision === 1 ? 'Old complete snapshot.' : 'New complete snapshot.');
    const results = await Promise.allSettled([foam.recover(), foam.recover()]);
    assert.ok(results.some(r => r.status === 'fulfilled' && r.value.recovered));
    const owner = (await foam.status()).writer;
    assert.equal(owner.state, 'unlocked');
    assert.deepEqual(await foam.inspect(), snapshot); // Recovery never replays the encounter.
    assert.equal((await foam.prepare({ cue: 'next', occurrence: 'next' })).revision, snapshot.revision + 1);
  });
}

test('legacy, foreign, live reused PID and abandoned coordination gate fail closed', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-unknown-lock-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'private', inference });
  await foam.prepare({ cue: 'old', occurrence: 'old' });
  const old = await readFile(join(directory, 'memory.md'));
  await mkdir(join(directory, '.writer.lock'));
  await assert.rejects(foam.recover(), /Unknown/);
  await writeFile(join(directory, '.writer.lock/owner.json'), JSON.stringify({ operationId: 'other', pid: process.pid, started: 'different process identity', host: 'foreign-host' }));
  await assert.rejects(foam.recover(), /foreign/);
  await writeFile(join(directory, '.writer.lock/owner.json'), JSON.stringify({ operationId: 'other', pid: process.pid, started: 'different process identity', host: hostname() }));
  await assert.rejects(foam.recover(), /reused live PID/);
  await mkdir(join(directory, '.coordination.lock'));
  await assert.rejects(foam.recover(), /coordination gate/);
  assert.deepEqual(await readFile(join(directory, 'memory.md')), old);
});
