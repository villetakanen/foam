import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, ModelRuntime } from '@earendil-works/pi-coding-agent';
import { Foam } from '../src/core.js';
import { registerFoam } from '../src/adapters/pi.js';

test('actual Pi session delivers memory to the provider and observes its response', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-runtime-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory: join(directory, 'memory'), scope: 'synthetic',
    inference: { async infer() { return { markdown: 'The repair is complete.', context: 'The repair is complete.' }; } } });
  const settingsManager = SettingsManager.inMemory({});
  const modelRuntime = await ModelRuntime.create({ authPath: join(directory, 'auth.json'), modelsPath: null,
    modelsStorePath: join(directory, 'models-cache.json'), refreshOnCreate: false });
  modelRuntime.registerProvider('foam-test', { baseUrl: 'http://127.0.0.1:1', apiKey: 'synthetic-key', api: 'openai-completions',
    models: [{ id: 'fixture', name: 'Fixture', reasoning: false, input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32000, maxTokens: 1000 }] });
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir: directory, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [pi => registerFoam(pi, foam)] });
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
