import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializeProject, openProjectMemory } from '../src/project.js';
import { Foam } from '../src/core.js';
import { INTERPRETER_PROMPT } from '../src/inference.js';
import { piInference } from '../src/adapters/pi-inference.js';
import { langGraphInference, memoryNodes, MEMORY_CALL_TAG } from '../src/adapters/langgraph.js';
import type { InferenceInput } from '../src/types.js';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';

const proposal = { markdown: 'Pool hours may be relevant.', context: 'Possibly pool hours.' };
const input: InferenceInput = { instruction: INTERPRETER_PROMPT, operation: 'prepare',
  memory: { scope: 'private', revision: 0, markdown: '' }, encounter: { cue: 'Times again?', occurrence: 'one' },
  limits: { memoryBytes: 2048, contextBytes: 2048 } };
const signal = () => new AbortController().signal;

test('explicit adapter > configured backend > host default, with no failure fallback', async t => {
  const root = await mkdtemp(join(tmpdir(), 'foam-host-priority-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = await initializeProject(root);
  let hostCalls = 0;
  const hostInference = { describe: () => ({ source: 'test-host', model: 'current' }), async infer() { hostCalls++; return proposal; } };
  const host = await openProjectMemory({ projectRoot: root, scope: 'private', hostInference });
  await host.prepare(input.encounter);
  assert.equal(hostCalls, 1);
  assert.deepEqual((await host.status()).backend, { source: 'host', model: 'current' });
  config.inference = { endpoint: 'http://127.0.0.1:1/v1/chat/completions', model: 'override' };
  await writeFile(join(root, 'foam.config.json'), JSON.stringify(config));
  const configured = await openProjectMemory({ projectRoot: root, scope: 'private', hostInference });
  assert.equal((await configured.status()).backend?.source, 'project');
  const before = await configured.inspect();
  await assert.rejects(configured.prepare(input.encounter));
  assert.deepEqual(await configured.inspect(), before);
  assert.equal(hostCalls, 1);
  const explicit = await openProjectMemory({ projectRoot: root, scope: 'private', hostInference,
    inference: { async infer() { return proposal; } } });
  await explicit.prepare(input.encounter);
  assert.equal((await explicit.status()).backend?.source, 'explicit');
  assert.equal(hostCalls, 1);
});

test('Pi captures one model per operation, forwards cancellation and handles switches/errors', async () => {
  const calls: any[] = [];
  let model: any = { id: 'first', provider: 'host' };
  let mode = 'stop';
  const adapter = piInference(() => ({ model, modelRegistry: { streamSimple(selected: any, context: any, options: any) {
    calls.push({ selected, context, options });
    model = { id: 'second', provider: 'host' };
    return { result: async () => ({ stopReason: mode, content: mode === 'tool' ? [{ type: 'toolCall' }] : [{ type: 'text', text: JSON.stringify(proposal) }] }) };
  } } as any }));
  const abort = signal();
  const metadata: any[] = [];
  assert.deepEqual(await adapter.infer(input, abort, record => metadata.push(record)), proposal);
  assert.deepEqual(metadata[0].backend, { source: 'pi', provider: 'host', model: 'first' });
  assert.equal(adapter.describe?.().model, 'second');
  assert.equal(calls[0].selected.id, 'first');
  assert.equal(calls[0].options.signal, abort);
  assert.equal(calls[0].options.maxRetries, 0);
  assert.equal(calls[0].context.tools, undefined);
  assert.equal(calls[0].context.messages.length, 1);
  assert.deepEqual(await adapter.infer(input, signal()), proposal);
  assert.equal(calls[1].selected.id, 'second');
  mode = 'length';
  await assert.rejects(adapter.infer(input, signal()), /did not complete/);
  model = undefined;
  await assert.rejects(adapter.infer(input, signal()), /No active Pi model/);
  await assert.rejects(adapter.infer(input, AbortSignal.abort()), /abort/i);
});

test('LangGraph adapter routes per call, passes configuration, rejects tools/truncation and preserves memory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-host-lang-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let response: unknown = { content: JSON.stringify(proposal), tool_calls: [], additional_kwargs: { tool_calls: [] }, response_metadata: { finish_reason: 'stop' } };
  let route = 'one';
  const calls: any[] = [];
  const adapter = langGraphInference(async (messages, options) => { calls.push({ route, messages, options }); return response; },
    { configure: () => ({ configurable: { region: 'local' }, tags: ['application'], metadata: { case: 'test' } }),
      describe: () => ({ model: route }) });
  const foam = new Foam({ directory, scope: 'private', inference: adapter });
  await foam.prepare(input.encounter);
  route = 'two';
  await foam.prepare(input.encounter);
  assert.deepEqual(calls.map(c => c.route), ['one', 'two']);
  assert.equal(calls[0].messages.length, 2);
  assert.deepEqual(calls[0].options.configurable, { region: 'local' });
  assert.ok(calls[0].options.tags.includes(MEMORY_CALL_TAG));
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  const before = await foam.inspect();
  for (const invalid of [
    { content: JSON.stringify(proposal), tool_calls: [{ name: 'danger' }] },
    { content: JSON.stringify(proposal), response_metadata: { finish_reason: 'length' } },
    { content: [{ type: 'tool_use', name: 'danger' }] },
    { content: 'not json' }, { content: 'x'.repeat(262145) },
  ]) {
    response = invalid;
    await assert.rejects(foam.prepare(input.encounter));
    assert.deepEqual(await foam.inspect(), before);
  }
  const count = calls.length;
  await assert.rejects(adapter.infer(input, AbortSignal.abort()), /abort/i);
  assert.equal(calls.length, count);
});

test('real LangGraph shares a model with memory and filters its stream events', async t => {
  const root = await mkdtemp(join(tmpdir(), 'foam-shared-graph-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeProject(root);
  const model = new FakeListChatModel({ responses: [JSON.stringify(proposal), 'Do you mean the pool hours?', JSON.stringify(proposal)] });
  const foam = await openProjectMemory({ projectRoot: root, scope: 'private', hostInference: langGraphInference(model) });
  const State = Annotation.Root({ cue: Annotation<string>(), occurrence: Annotation<string>(), observations: Annotation<string[]>(),
    foamRevision: Annotation<number>(), foamContext: Annotation<string>(), foamAccess: Annotation<any>() });
  const nodes = memoryNodes(foam);
  const graph = new StateGraph(State).addNode('prepare', nodes.prepare).addNode('reply', async state => {
    const reply = await model.invoke([{ role: 'system', content: state.foamContext }, { role: 'user', content: state.cue }]);
    return { observations: [String(reply.content)] };
  }).addNode('observe', nodes.observe).addEdge(START, 'prepare').addEdge('prepare', 'reply').addEdge('reply', 'observe').addEdge('observe', END).compile();
  const visible: unknown[] = [];
  let hidden = 0;
  for await (const event of graph.streamEvents({ cue: 'Times again?', occurrence: 'graph-one', observations: [] }, { version: 'v2' })) {
    if (event.event !== 'on_chat_model_end') continue;
    if (event.tags?.includes(MEMORY_CALL_TAG)) { hidden++; continue; }
    visible.push(event.data.output.content);
  }
  assert.equal(hidden, 2);
  assert.deepEqual(visible, ['Do you mean the pool hours?']);
  assert.equal((await foam.inspect()).revision, 2);
});


test('host cancellation and provider/auth errors leave committed memory intact', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-host-errors-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const host of ['pi', 'langgraph']) {
    let fail = false;
    let aborted = false;
    const call = async (signal: AbortSignal) => {
      if (fail) throw new Error('Host authentication unavailable');
      if (aborted) return new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      return JSON.stringify(proposal);
    };
    const inference = host === 'pi'
      ? piInference(() => ({ model: { id: 'host', provider: 'test' }, modelRegistry: {
        streamSimple: (_m: unknown, _c: unknown, options: { signal: AbortSignal }) => ({ result: async () => ({
          stopReason: 'stop', content: [{ type: 'text', text: await call(options.signal) }],
        }) }),
      } } as any))
      : langGraphInference(async (_messages, options) => call(options.signal));
    const foam = new Foam({ directory: join(directory, host), scope: 'private', inference, timeoutMs: 30 });
    await foam.prepare(input.encounter);
    const before = await foam.inspect();
    fail = true;
    await assert.rejects(foam.prepare(input.encounter), /authentication unavailable/);
    assert.deepEqual(await foam.inspect(), before);
    fail = false;
    aborted = true;
    await assert.rejects(foam.prepare(input.encounter), /timed out|timeout|abort/i);
    assert.deepEqual(await foam.inspect(), before);
  }
});
