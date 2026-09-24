import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateActivity } from '../examples/activity-evaluation.js';
import type { ActivityScenario } from '../examples/activity-fixtures.js';

const scenario: ActivityScenario = { id: 'test', title: 'Test chronological replay', turns: [
  { user: 'Initial question.', outcomes: [{ role: 'tool', text: 'First observation.' }],
    checkpoint: { id: 'first', cue: 'Continue the investigation.', expectations: ['REVIEWER_ONLY_CRITERION'] } },
  { user: 'SECOND_TURN_EVIDENCE', outcomes: [{ role: 'assistant', text: 'Later explanation.' }] },
] };

test('activity eval starts empty, prevents future/rubric leakage and isolates client branches', async () => {
  const inferenceInputs: any[] = [];
  const textInputs: any[] = [];
  const result = await evaluateActivity({ scenario, inference: { async infer(input) {
    inferenceInputs.push(input);
    assert.ok(!JSON.stringify(input).includes('REVIEWER_ONLY_CRITERION'));
    assert.ok(!JSON.stringify(input).includes('CLIENT_BRANCH_OUTPUT'));
    return { markdown: 'Current working summary.', context: 'Useful focused view.' };
  } }, text: async request => {
    textInputs.push(request);
    assert.ok(!JSON.stringify(request).includes('REVIEWER_ONLY_CRITERION'));
    return request.purpose === 'client' ? 'CLIENT_BRANCH_OUTPUT' : 'Ordinary rolling summary.';
  } });
  assert.equal(result.records[0].memory.revision, 0);
  assert.equal(result.records[0].memory.markdown, '');
  assert.equal(inferenceInputs[0].operation, 'observe');
  assert.equal(inferenceInputs[0].encounter.suppliedContext, undefined);
  assert.deepEqual(inferenceInputs.map(input => input.operation), ['observe', 'prepare', 'observe']);
  for (const input of inferenceInputs.slice(0, 2)) assert.ok(!JSON.stringify(input).includes('SECOND_TURN_EVIDENCE'));
  const clients = textInputs.filter(input => input.purpose === 'client');
  assert.equal(clients.length, 3);
  for (const client of clients) {
    assert.ok(!client.content.includes('SECOND_TURN_EVIDENCE'));
    assert.ok(!client.instruction.includes('JSON'));
    assert.ok(client.content.endsWith('Continue the investigation.'));
  }
  assert.deepEqual(new Set(result.records[2].clients.map((client: any) => client.condition)), new Set(['foam', 'rolling', 'recent-only']));
  assert.equal(result.finalMemory.revision, 3);
});

test('failure in one memory condition does not suppress independent comparisons', async () => {
  let count = 0;
  const result = await evaluateActivity({ scenario, memoryBytes: 128, contextBytes: 128,
    inference: { async infer(input) {
      if (input.operation === 'prepare') throw new Error('prepare unavailable');
      return { markdown: 'Retained memory.', context: '' };
    } }, text: async request => {
      if (request.purpose === 'rolling-summary') return ++count === 1 ? 'Previous valid summary.' : 'x'.repeat(129);
      return 'Natural continuation.';
    } });
  const probe = result.records.find(record => record.kind === 'checkpoint');
  assert.match(probe.prepareError, /unavailable/);
  assert.ok(probe.clients.find((client: any) => client.condition === 'foam').unavailable);
  assert.equal(probe.clients.filter((client: any) => client.reply).length, 2);
  assert.match(result.records.at(-1).rollingError, /exceeds budget/);
  assert.equal(result.finalRolling, 'Previous valid summary.');
});

test('successive reads receive preceding committed memory without observing client branches', async () => {
  const inputs: any[] = [];
  const successive: ActivityScenario = { id: 'reads', title: 'Successive attention', turns: [{
    user: 'Choose a direction.', outcomes: [{ role: 'tool', text: 'Available evidence.' }],
    checkpoint: { id: 'plan', cue: 'Current plan?', expectations: ['PRIVATE_CRITERION'] },
    subsequentReads: [
      { id: 'reason', cue: 'Why this direction?', expectations: ['PRIVATE_CRITERION'] },
      { id: 'return', cue: 'Return to the plan.', expectations: ['PRIVATE_CRITERION'] },
    ],
  }] };
  let summaryCalls = 0;
  const result = await evaluateActivity({ scenario: successive,
    inference: { async infer(input) {
      inputs.push(input);
      assert.ok(!JSON.stringify(input).includes('PRIVATE_CRITERION'));
      assert.ok(!JSON.stringify(input).includes('UNOBSERVED_CLIENT_REPLY'));
      return { markdown: `Account after encounter ${inputs.length}.`, context: 'Grounded view.' };
    } }, text: async request => {
      if (request.purpose === 'client') return 'UNOBSERVED_CLIENT_REPLY';
      summaryCalls++;
      return 'Rolling account.';
    } });
  assert.deepEqual(inputs.map(input => input.operation), ['observe', 'prepare', 'prepare', 'prepare']);
  const probes = result.records.filter(record => record.kind === 'checkpoint');
  assert.equal(probes.length, 3);
  for (let index = 0; index < probes.length; index++) {
    assert.equal(inputs[index + 1].memory.markdown, `Account after encounter ${index + 1}.`);
    assert.equal(probes[index].memoryBeforeAccess.markdown, `Account after encounter ${index + 1}.`);
    assert.equal(probes[index].memoryAfterAccess.markdown, `Account after encounter ${index + 2}.`);
    assert.equal(probes[index].rolling, 'Rolling account.');
    assert.deepEqual(probes[index].recentExchange, probes[0].recentExchange);
  }
  assert.equal(summaryCalls, 1);
});

test('fresh sessions reopen persisted memory without leaking transcript or fixture identity', async () => {
  const inferenceInputs: any[] = [];
  const clients: any[] = [];
  const reset: ActivityScenario = { id: 'SECRET_POOL_ANSWER', title: 'SECRET_TITLE', turns: [{
    user: 'OLD_TRANSCRIPT_DETAIL', outcomes: [{ role: 'assistant', text: 'OLD_REPLY_DETAIL' }],
    checkpoint: { id: 'SECRET_CHECKPOINT', freshSession: true, cue: 'What was that again?', expectations: ['SECRET_CRITERION'] },
    subsequentReads: [{ id: 'SECRET_SECOND', cue: 'And now?', expectations: [] }],
  }, { user: 'NEW_SESSION_DETAIL', outcomes: [{ role: 'assistant', text: 'New session reply.' }] }] };
  const result = await evaluateActivity({ scenario: reset, inference: { async infer(input) {
    inferenceInputs.push(input);
    for (const secret of ['SECRET_POOL_ANSWER', 'SECRET_TITLE', 'SECRET_CHECKPOINT', 'SECRET_SECOND', 'SECRET_CRITERION']) {
      assert.ok(!JSON.stringify(input).includes(secret));
    }
    return { markdown: 'Persisted association.', context: 'Possible association.' };
  } }, text: async request => {
    if (request.purpose === 'client') clients.push(request);
    return request.purpose === 'client' ? 'Hypothetical reply.' : 'Persisted rolling summary.';
  } });
  for (const input of inferenceInputs.slice(1, 3)) {
    assert.equal(input.memory.markdown, 'Persisted association.');
    assert.deepEqual(input.encounter.recentExchange, []);
    assert.ok(!JSON.stringify(input).includes('OLD_TRANSCRIPT_DETAIL'));
  }
  assert.ok(!JSON.stringify(inferenceInputs.at(-1)).includes('OLD_REPLY_DETAIL'));
  for (const client of clients) {
    assert.ok(!client.content.includes('OLD_TRANSCRIPT_DETAIL'));
    assert.ok(!client.content.includes('OLD_REPLY_DETAIL'));
    assert.ok(client.content.includes('Recent exchange:\n\n\nCurrent user:'));
  }
  const probe = result.records.find(record => record.kind === 'checkpoint');
  assert.equal(probe.freshSession, true);
  assert.equal(probe.memoryBeforeAccess.revision, 1);
  assert.equal(probe.clients.find((client: any) => client.condition === 'recent-only').suppliedContext, '');
  assert.equal(probe.clients.find((client: any) => client.condition === 'rolling').suppliedContext, 'Persisted rolling summary.');
});
