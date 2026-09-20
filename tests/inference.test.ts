import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonInference, inferenceFromEnv, INTERPRETER_PROMPT } from '../src/inference.js';
import type { InferenceInput } from '../src/types.js';

const input: InferenceInput = { instruction: INTERPRETER_PROMPT, operation: 'prepare',
  memory: { scope: 'test', revision: 0, markdown: '' }, encounter: { cue: 'hello', occurrence: 'one' },
  limits: { memoryBytes: 1000, contextBytes: 200 } };

test('HTTP inference sends data separately and accepts complete JSON', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, request: RequestInit) => {
    const body = JSON.parse(request.body as string);
    assert.equal(body.model, 'test-model');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(JSON.parse(body.messages[1].content).memory.scope, 'test');
    assert.equal(request.redirect, 'error');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"markdown":"hello","context":"hello"}' } }] });
  });
  const adapter = jsonInference({ endpoint: 'http://localhost:1234/v1/chat/completions', model: 'test-model' });
  assert.deepEqual(await adapter.infer(input, new AbortController().signal), { markdown: 'hello', context: 'hello' });
});

test('HTTP errors, truncated output, bad JSON and oversized responses fail', async t => {
  let response: Response;
  t.mock.method(globalThis, 'fetch', async () => response);
  const adapter = jsonInference({ endpoint: 'https://example.com/v1/chat/completions', model: 'test-model' });
  for (const value of [new Response('secret provider detail', { status: 401 }),
    Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }),
    Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] }),
    new Response('x'.repeat(262145))]) {
    response = value;
    await assert.rejects(adapter.infer(input, new AbortController().signal), error => !String(error).includes('secret provider detail'));
  }
});

test('configuration requires an explicit model, endpoint and secure remote transport', () => {
  assert.throws(() => inferenceFromEnv({}), /FOAM_MODEL/);
  assert.throws(() => jsonInference({ endpoint: 'http://remote.example/v1', model: 'test' }), /HTTPS/);
  assert.throws(() => jsonInference({ endpoint: 'https://example.com', model: '' }), /model/);
});
