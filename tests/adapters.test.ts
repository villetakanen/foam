import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foam } from '../src/core.js';
import { registerFoam } from '../src/adapters/pi.js';
import { memoryNodes } from '../src/adapters/langgraph.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { InferenceInput } from '../src/types.js';
import { fixtureInference, cues } from '../examples/fixture.js';

test('Pi lifecycle and graph nodes share policy inputs across the scenario suite', async t => {
  const directories = await Promise.all([0, 1].map(() => mkdtemp(join(tmpdir(), 'foam-adapter-'))));
  t.after(async () => { await Promise.all(directories.map(directory => rm(directory, { recursive: true, force: true }))); });
  const inputs: InferenceInput[][] = [[], []];
  const foams = directories.map((directory, i) => new Foam({ directory, scope: 'same', inference: { async infer(input, signal) {
    inputs[i]!.push(input); return fixtureInference.infer(input, signal);
  } } }));
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  const entries: unknown[] = [];
  let inspectHandler: any;
  const pi = { on: (name: string, handler: any) => handlers.set(name, handler),
    appendEntry: (customType: string, data: unknown) => entries.push({ type: 'custom', customType, data }),
    registerCommand: (_name: string, options: any) => { inspectHandler = options.handler; } };
  registerFoam(pi as unknown as ExtensionAPI, foams[0]!);
  const notices: string[] = [];
  const ctx = { ui: { notify: (message: string) => notices.push(message), editor: async () => '' }, sessionManager: { getBranch: () => entries } };
  await handlers.get('session_start')!({}, ctx);
  const graph = memoryNodes(foams[1]!);
  let graphRevision = 0;
  for (const cue of cues) {
    await handlers.get('before_agent_start')!({ prompt: cue }, ctx);
    const event = { messages: [{ role: 'user', content: cue }, { role: 'custom', customType: 'foam-context', content: 'old' }] };
    const result = await handlers.get('context')!(event, ctx);
    assert.equal(result.messages.filter((m: any) => m.customType === 'foam-context').length, 1);
    const piInput = inputs[0]!.at(-1)!;
    const state = { cue, occurrence: piInput.encounter.occurrence, observations: ['Actual result'], recentExchange: piInput.encounter.recentExchange!, foamRevision: graphRevision };
    const prepared = await graph.prepare(state);
    assert.equal(prepared.foamContext, result.messages.at(-1).content);
    await handlers.get('turn_end')!({ message: { content: [{ type: 'text', text: 'Actual result' }] }, toolResults: [] }, ctx);
    const observed = await graph.observe({ ...state, ...prepared, recentExchange: [...state.recentExchange, { role: 'assistant', text: 'Actual result' }] });
    graphRevision = observed.foamRevision;
  }
  const normalize = (input: InferenceInput) => JSON.parse(JSON.stringify(input, (key, value) => key === 'id' ? '<access>' : value));
  assert.deepEqual(inputs[0]!.map(normalize), inputs[1]!.map(normalize));
  assert.deepEqual(await foams[0]!.inspect(), await foams[1]!.inspect());
  const revision = (await foams[0]!.inspect()).revision;
  await inspectHandler('', ctx);
  assert.equal((await foams[0]!.inspect()).revision, revision);
  assert.deepEqual(await handlers.get('session_before_tree')!({}, ctx), { cancel: true });
  assert.deepEqual(await handlers.get('session_before_fork')!({}, ctx), { cancel: true });
  await assert.rejects(graph.prepare({ cue: 'old', occurrence: 'rewind', observations: [], foamRevision: 0 }), /Revision conflict/);
  await assert.rejects(graph.observe({ cue: 'old', occurrence: 'unprepared', observations: [] }), /Prepare before/);
  assert.equal(notices.length, 2);
});

test('Pi failures remove old context and resumed revision mismatch disables memory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-pi-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'pi', inference: { async infer() { throw new Error('offline'); } } });
  const handlers = new Map<string, any>();
  registerFoam({ on: (name: string, handler: any) => handlers.set(name, handler), registerCommand() {}, appendEntry() {} } as unknown as ExtensionAPI, foam);
  const ctx = { ui: { notify() {} }, sessionManager: { getBranch: () => [] } };
  await handlers.get('session_start')({}, ctx);
  const event = { messages: [{ role: 'custom', customType: 'foam-context', content: 'stale' }] };
  assert.deepEqual(await handlers.get('context')(event, ctx), { messages: [] });
  ctx.sessionManager.getBranch = () => [{ type: 'custom', customType: 'foam-revision', data: { scope: 'pi', revision: 7 } }] as never[];
  await handlers.get('session_start')({}, ctx);
  assert.deepEqual(await handlers.get('context')(event, ctx), { messages: [] });
});

test('Pi project-open failure cannot reuse a previous project binding', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-pi-binding-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const foam = new Foam({ directory, scope: 'old-project', inference: fixtureInference });
  let fail = false;
  const handlers = new Map<string, any>();
  registerFoam({ on: (name: string, handler: any) => handlers.set(name, handler), registerCommand() {}, appendEntry() {} } as unknown as ExtensionAPI,
    async () => { if (fail) throw new Error('New project has no config'); return foam; });
  const notices: string[] = [];
  const ctx = { cwd: directory, ui: { notify(message: string) { notices.push(message); } }, sessionManager: { getBranch: () => [] } };
  await handlers.get('session_start')({}, ctx);
  await handlers.get('before_agent_start')({ prompt: 'The sink is leaking' }, ctx);
  await handlers.get('context')({ messages: [] }, ctx);
  const revision = (await foam.inspect()).revision;
  fail = true;
  await handlers.get('session_start')({}, ctx);
  assert.deepEqual(await handlers.get('context')({ messages: [] }, ctx), { messages: [] });
  assert.equal((await foam.inspect()).revision, revision);
  assert.match(notices.at(-1)!, /New project has no config/);
});
