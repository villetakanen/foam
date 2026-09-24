import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foam, initializeProject, openProjectMemory, readProjectConfig, projectStatus, migrateMemory } from '../src/index.js';
const inference = { async infer() { return { markdown: 'Known radiator dimensions.', context: 'Radiator' }; } };

test('project initialization preserves settings, shares scope, isolates names and requires explicit backend', async t => {
  const root = await mkdtemp(join(tmpdir(), 'foam-project-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, '.gitignore'), 'existing-rule');
  await initializeProject(root);
  await assert.rejects(openProjectMemory({ projectRoot: root, scope: 'private' }), /Inject/);
  const config = await readProjectConfig(root);
  config.scopes.team = { directory: 'team' };
  await writeFile(join(root, 'foam.config.json'), JSON.stringify(config));
  await initializeProject(root);
  assert.deepEqual(await readProjectConfig(root), config);
  assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), 'existing-rule\n/.foam/\n');
  const first = await openProjectMemory({ projectRoot: root, scope: 'private', inference });
  await first.prepare({ cue: 'radiator', occurrence: 'one' });
  const second = await openProjectMemory({ projectRoot: root, scope: 'private', inference });
  assert.deepEqual(await second.inspect(), await first.inspect());
  const separate = await openProjectMemory({ projectRoot: root, scope: 'team', inference });
  assert.equal((await separate.inspect()).revision, 0);
  await assert.rejects(projectStatus(root, '__proto__'), /not declared/);
  await mkdir(join(root, 'child'));
  await assert.rejects(projectStatus(join(root, 'child'), 'private'), /ENOENT/);
});

test('project config rejects traversal, aliases, symlinks, secrets and unsupported policy', async t => {
  const root = await mkdtemp(join(tmpdir(), 'foam-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = await initializeProject(root);
  for (const change of [
    { memoryRoot: '../outside' }, { memoryRoot: '/tmp' }, { policyVersion: 'future' },
    { scopes: { a: { directory: '../outside' } } }, { scopes: { a: { directory: 'same' }, b: { directory: 'same' } } },
    { scopes: { a: { directory: 'one' }, b: { directory: 'one/child' } } },
    { scopes: { a: { directory: 'a', scope: 'same' }, b: { directory: 'b', scope: 'same' } } },
    { inference: { endpoint: 'https://example.com', model: 'test', apiKey: 'must-not-store' } },
    { budgets: { maxInputBytes: -1 } },
  ]) {
    await writeFile(join(root, 'foam.config.json'), JSON.stringify({ ...base, ...change }));
    await assert.rejects(readProjectConfig(root));
  }
  await writeFile(join(root, 'foam.config.json'), JSON.stringify(base));
  await symlink(tmpdir(), join(root, '.foam'));
  await assert.rejects(readProjectConfig(root), /real directories/);
});

test('migration preserves exact scope, revision and Markdown and never overwrites destination', async t => {
  const root = await mkdtemp(join(tmpdir(), 'foam-migration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root);
  const source = new Foam({ directory: join(root, 'legacy'), scope: 'private', inference });
  await source.prepare({ cue: 'one', occurrence: 'one' });
  await source.prepare({ cue: 'two', occurrence: 'two' });
  const before = await readFile(join(source.directory, 'memory.md'));
  const result = await migrateMemory({ sourceDirectory: source.directory, projectRoot: root, scope: 'private' });
  assert.equal(result.migrated, true);
  assert.deepEqual(result.snapshot, await source.inspect());
  assert.deepEqual(await readFile(join(root, '.foam/private/memory.md')), before);
  assert.deepEqual(await readFile(join(source.directory, 'memory.md')), before);
  await assert.rejects(migrateMemory({ sourceDirectory: source.directory, projectRoot: root, scope: 'private' }), /already contains/);
  assert.equal((await migrateMemory({ sourceDirectory: join(root, '.foam/private'), projectRoot: root, scope: 'private' })).migrated, false);
});

test('an opened project rejects a subsequently substituted parent symlink', async t => {
  const root = await mkdtemp(join(tmpdir(), 'foam-path-change-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root);
  const foam = await openProjectMemory({ projectRoot: root, scope: 'private', inference });
  await symlink(tmpdir(), join(root, '.foam'));
  await assert.rejects(foam.inspect(), /real directories/);
  await assert.rejects(foam.prepare({ cue: 'x', occurrence: 'x' }), /real directories/);
  await assert.rejects(foam.recover(), /real directories/);
});
