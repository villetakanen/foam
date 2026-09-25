import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, ModelRuntime } =
  await import(process.env.FOAM_TEST_PI_SDK ?? '@earendil-works/pi-coding-agent') as typeof import('@earendil-works/pi-coding-agent');
import { initializeProject, openProjectMemory } from '../src/index.js';
import foamExtension, { registerFoam } from '../src/adapters/pi.js';

test('actual Pi session delivers memory to the provider and observes its response', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-runtime-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await initializeProject(directory, 'synthetic');
  const inference = { async infer() { return { markdown: 'The repair is complete.', context: 'The repair is complete.' }; } };
  const foam = await openProjectMemory({ projectRoot: directory, scope: 'synthetic', inference });
  const settingsManager = SettingsManager.inMemory({});
  const modelRuntime = await ModelRuntime.create({ authPath: join(directory, 'auth.json'), modelsPath: null,
    modelsStorePath: join(directory, 'models-cache.json'), refreshOnCreate: false });
  modelRuntime.registerProvider('foam-test', { baseUrl: 'http://127.0.0.1:1', apiKey: 'synthetic-key', api: 'openai-completions',
    models: [{ id: 'fixture', name: 'Fixture', reasoning: false, input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32000, maxTokens: 1000 }] });
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir: directory, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [pi => registerFoam(pi, projectRoot => openProjectMemory({ projectRoot, scope: 'synthetic', inference }))] });
  await loader.reload();
  const model = modelRuntime.getModel('foam-test', 'fixture');
  assert.ok(model);
  const { session } = await createAgentSession({ cwd: directory, agentDir: directory, modelRuntime, model,
    resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(directory), noTools: 'all' });
  try {
    await session.bindExtensions({});
    let calls = 0;
    session.agent.streamFunction = (_model, context) => {
      calls++;
      assert.match(JSON.stringify(context.messages), /The repair is complete/);
      const message = { role: 'assistant', content: [{ type: 'text', text: 'The repair is already complete.' }],
        api: 'openai-completions', provider: 'foam-test', model: 'fixture',
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'stop', timestamp: Date.now() };
      // Minimal in-process provider stream; no credentials or network requests.
      return { [Symbol.asyncIterator]: async function* () { yield { type: 'done', reason: 'stop', message }; },
        result: async () => message } as unknown as ReturnType<typeof session.agent.streamFunction>;
    };
    await session.prompt('What about that old plumber reminder?');
    assert.equal(calls, 1);
    assert.equal((await foam.inspect()).revision, 2);
  } finally { session.dispose(); }
});


test('Pi default shares the session provider/auth, follows model switches and hides memory turns', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-host-runtime-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await initializeProject(directory, 'private');
  const previousScope = process.env.FOAM_SCOPE;
  process.env.FOAM_SCOPE = 'private';
  t.after(() => { if (previousScope === undefined) delete process.env.FOAM_SCOPE; else process.env.FOAM_SCOPE = previousScope; });
  const settingsManager = SettingsManager.inMemory({});
  const modelRuntime = await ModelRuntime.create({ authPath: join(directory, 'auth.json'), modelsPath: null,
    modelsStorePath: join(directory, 'models-cache.json'), refreshOnCreate: false });
  const calls: { model: string; memory: boolean }[] = [];
  modelRuntime.registerProvider('shared-host', { baseUrl: 'http://127.0.0.1:1', apiKey: 'test-host-key', headers: { 'x-host-test': 'present' }, api: 'openai-completions',
    models: ['first', 'second'].map(id => ({ id, name: id, reasoning: false, input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32000, maxTokens: 4096 })),
    streamSimple(model, context, options) {
      assert.equal(options?.apiKey, 'test-host-key');
      assert.equal(options?.headers?.['x-host-test'], 'present');
      const memory = JSON.stringify(context).includes('complete next memory');
      calls.push({ model: model.id, memory });
      if (memory) {
        assert.equal(options?.maxRetries, 0);
        assert.equal(options?.maxTokens, 4096);
        assert.equal(context.messages.filter(m => m.role === 'user').length, 1);
      }
      const message = { role: 'assistant', content: [{ type: 'text', text: memory
        ? JSON.stringify({ markdown: 'Pool hours may be relevant.', context: 'Possibly pool hours.' })
        : 'Do you mean pool hours?' }], api: 'openai-completions', provider: 'shared-host', model: model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'stop', timestamp: Date.now() };
      return { [Symbol.asyncIterator]: async function* () { yield { type: 'done', reason: 'stop', message }; },
        result: async () => message } as any;
    } });
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir: directory, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [foamExtension] });
  await loader.reload();
  const { session } = await createAgentSession({ cwd: directory, agentDir: directory, modelRuntime,
    model: modelRuntime.getModel('shared-host', 'first')!, resourceLoader: loader, settingsManager,
    sessionManager: SessionManager.inMemory(directory), noTools: 'all' });
  try {
    await session.bindExtensions({});
    await session.prompt('What were the times again?');
    await session.setModel(modelRuntime.getModel('shared-host', 'second')!);
    await session.prompt('And the hours?');
    assert.deepEqual(calls, [
      { model: 'first', memory: true }, { model: 'first', memory: false }, { model: 'first', memory: true },
      { model: 'second', memory: true }, { model: 'second', memory: false }, { model: 'second', memory: true },
    ]);
    const replies = session.agent.state.messages.filter(m => m.role === 'assistant');
    assert.equal(replies.length, 2);
    assert.ok(!JSON.stringify(replies).includes('markdown'));
    const check = await openProjectMemory({ projectRoot: directory, scope: 'private', inference: { async infer() { throw Error('Inspection only'); } } });
    assert.equal((await check.inspect()).revision, 4);
  } finally { session.dispose(); }
});
