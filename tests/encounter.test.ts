import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foam } from '../src/index.js';
import { memoryNodes } from '../src/adapters/langgraph.js';
import { registerFoam } from '../src/adapters/pi.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { InferenceInput, ExchangeMessage } from '../src/index.js';

// This verifies adapters preserve the evidence needed for continuity, not model quality.
test('Pi, graph and embedded clients preserve split-exchange roles and tool evidence equivalently', async t => {
  const root = await mkdtemp(join(tmpdir(), 'foam-continuity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = JSON.parse(await readFile(new URL('./fixtures/continuity-cases.json', import.meta.url), 'utf8'));
  const inputs: InferenceInput[][] = [[], [], []];
  const foams = inputs.map((list, i) => new Foam({ directory: join(root, String(i)), scope: 'same', inference: { async infer(input) {
    list.push(input); return { markdown: fixture.description, context: fixture.description };
  } } }));
  const handlers = new Map<string, any>();
  registerFoam({ on: (name: string, handler: any) => handlers.set(name, handler), appendEntry() {}, registerCommand() {} } as unknown as ExtensionAPI, foams[0]!);
  const ctx = { ui: { notify(message: string) { assert.fail(message); } }, sessionManager: { getBranch: () => [] } };
  await handlers.get('session_start')({}, ctx);
  const nodes = memoryNodes(foams[1]!);
  let revision = 0;
  const recentExchange: ExchangeMessage[] = [];
  for (const cue of [fixture.description, fixture.request]) {
    recentExchange.push({ role: 'user', text: cue });
    await handlers.get('before_agent_start')({ prompt: cue }, ctx);
    await handlers.get('context')({ messages: recentExchange.map(message => ({ role: message.role === 'tool' ? 'toolResult' : message.role, content: message.text })) }, ctx);
    const piInput = inputs[0]!.at(-1)!;
    const encounter = { cue, occurrence: piInput.encounter.occurrence, recentExchange: structuredClone(recentExchange), expectedRevision: revision };
    const graphPrepared = await nodes.prepare({ ...encounter, observations: [], foamRevision: revision });
    const embeddedPrepared = await foams[2]!.prepare(encounter);
    const assistant = 'I have updated it.';
    const tool = 'notes (error): Permission denied; no update occurred.';
    await handlers.get('turn_end')({ message: { content: assistant }, toolResults: [{ toolName: 'notes', isError: true, content: 'Permission denied; no update occurred.' }] }, ctx);
    const observedExchange: ExchangeMessage[] = [...recentExchange, { role: 'assistant', text: assistant }, { role: 'tool', text: tool }];
    const graphObserved = await nodes.observe({ ...encounter, ...graphPrepared, recentExchange: observedExchange, observations: [assistant, tool] });
    await foams[2]!.observe({ ...encounter, recentExchange: observedExchange, observations: [assistant, tool], expectedRevision: embeddedPrepared.revision,
      access: embeddedPrepared.access, suppliedContext: embeddedPrepared.context });
    revision = graphObserved.foamRevision;
    recentExchange.push({ role: 'assistant', text: assistant }, { role: 'tool', text: tool });
  }
  const normalize = (value: unknown) => JSON.parse(JSON.stringify(value, (key, item) => key === 'id' ? '<access>' : item));
  assert.deepEqual(normalize(inputs[0]), normalize(inputs[1]));
  assert.deepEqual(normalize(inputs[0]), normalize(inputs[2]));
  const last = inputs[2]!.at(-1)!;
  assert.equal(last.encounter.recentExchange!.at(-1)!.role, 'tool');
  assert.equal(last.encounter.recentExchange![0]!.text, fixture.description);
});
