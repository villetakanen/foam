import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, totalmem } from 'node:os';
import { createHash } from 'node:crypto';
import { INTERPRETER_PROMPT, interpretationSchema } from '../dist/index.js';
import { recollectionScenarios as activityScenarios } from './recollection-fixtures.js';
import { evaluateActivity, memoryAdapter, summaryInstruction, clientInstruction } from './activity-evaluation.js';

const model = process.env.FOAM_MODEL;
if (!model) throw new Error('Set FOAM_MODEL to an installed local Ollama model');
const clientModel = process.env.FOAM_CLIENT_MODEL ?? model;
const trials = Number(process.env.FOAM_TRIALS ?? 1);
if (!Number.isSafeInteger(trials) || trials < 1 || trials > 10) throw new Error('FOAM_TRIALS must be 1–10');
const requested = process.env.FOAM_SCENARIO;
const scenarios = requested ? activityScenarios.filter(scenario => scenario.id === requested) : activityScenarios;
if (!scenarios.length) throw new Error(`FOAM_SCENARIO must be one of: ${activityScenarios.map(scenario => scenario.id).join(', ')}`);
const bytes = 2048;
const timeoutMs = 60000;
const path = process.env.FOAM_REPORT ?? '.foam/recollection-evaluation.json';
const base = 'http://127.0.0.1:11434';
const get = async (route: string) => {
  const response = await fetch(base + route, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new Error(`Local runtime HTTP ${response.status}`);
  return response.json();
};
const runtime = await get('/api/version');
const installed = (await get('/api/tags')).models;
const models = [...new Set([model, clientModel])].map(name => {
  const found = installed.find((entry: any) => entry.name === name);
  if (!found || found.remote_model || found.remote_host || name.endsWith('-cloud')) throw new Error(`Model must be installed locally: ${name}`);
  return found;
});
const calls: any[] = [];
const report: any = {
  protocol: 'partial-recollection-v1', date: new Date().toISOString(), model, clientModel, models, runtime,
  hardware: { cpu: cpus()[0]?.model, memoryBytes: totalmem(), platform: process.platform, arch: process.arch },
  settings: { temperature: 0, seeds: Array.from({ length: trials }, (_, i) => 42 + i), think: false, num_ctx: 16384, num_predict: 4096 },
  budgets: { storedMemoryBytes: bytes, suppliedContextBytes: bytes, completeInputBytes: 20480 },
  fixtureSha256: createHash('sha256').update(JSON.stringify(activityScenarios)).digest('hex'),
  policySha256: createHash('sha256').update(INTERPRETER_PROMPT).digest('hex'),
  prompts: { foam: INTERPRETER_PROMPT, rolling: summaryInstruction(bytes), client: clientInstruction },
  rubric: 'docs/evaluations/partial-recollection-v1.md', calls, runs: [], review: 'Unreviewed; protocol success is not semantic success',
  limitations: ['Synthetic development transcripts, not a validated benchmark or held-out sample.',
    'Scripted outcomes are replayed; continuation probes are separate branches and never alter subsequent transcript events.',
    'FOAM may change memory during checkpoint access; rolling summary is supplied directly without a focus call.',
    'Same state and injection byte caps; extra FOAM checkpoint calls are separately measured.',
    'Fresh-session probes reopen persisted memory and clear all recent transcript messages for memory and client alike.',
    'Channel switching is simulated by host context loss in one explicitly configured scope; no Discord/WhatsApp transport or identity matching is exercised.',
    'Useful partial associations and focused clarification are reviewed without requiring complete task-state reconstruction.',
    'Provider token counts are retrospective, not tokenizer admission; text-only replies do not execute tools.',
    'Temperature zero repetitions are not independent population samples.'],
};
const save = async () => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + '.tmp', JSON.stringify(report, null, 2) + '\n');
  await rename(path + '.tmp', path);
};
let seed = 42;
let activeScenario = '';
let activeTrial = 0;
async function generate(purpose: string, name: string, instruction: string, content: string, signal: AbortSignal) {
  const request = { model: name, stream: false, think: false,
    ...(purpose === 'memory' ? { format: interpretationSchema } : {}),
    options: { temperature: 0, seed, num_ctx: 16384, num_predict: 4096 },
    messages: [{ role: 'system', content: instruction }, { role: 'user', content }] };
  const started = performance.now();
  const call: any = { id: calls.length, scenario: activeScenario, trial: activeTrial, purpose, model: name,
    inputBytes: Buffer.byteLength(JSON.stringify(request)), instruction, content };
  calls.push(call);
  try {
    if (call.inputBytes > 20480) throw new Error('Complete request exceeds input byte budget');
    const response = await fetch(base + '/api/chat', { method: 'POST', signal, redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    if (!response.ok || !response.body) throw new Error(`Local inference HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 262144) throw new Error('Response exceeds byte budget');
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    call.raw = body.message?.content;
    call.inputTokens = body.prompt_eval_count; call.outputTokens = body.eval_count;
    call.loadMs = body.load_duration / 1e6;
    call.outputBytes = Buffer.byteLength(body.message?.content ?? '');
    if (!body.done || body.done_reason !== 'stop' || typeof body.message?.content !== 'string') throw new Error('Incomplete response');
    return body.message.content as string;
  } catch (error) { call.error = String(error); throw error; }
  finally { call.latencyMs = performance.now() - started; }
}
await save();
for (let trial = 0; trial < trials; trial++) {
  activeTrial = trial + 1; seed = 42 + trial;
  for (const scenario of scenarios) {
    activeScenario = scenario.id;
    const partial: any = { scenario: scenario.id, trial: activeTrial, records: [] };
    report.runs.push(partial);
    const result = await evaluateActivity({ scenario,
      inference: memoryAdapter((instruction, content, signal) => generate('memory', model, instruction, content, signal)),
      text: request => generate(request.purpose, request.purpose === 'client' ? clientModel : model,
        request.instruction, request.content, AbortSignal.timeout(timeoutMs)),
      onRecord: async record => { partial.records.push(record); await save(); console.error(`${scenario.id}: ${record.kind}${record.id ? ' ' + record.id : ''}`); },
    });
    Object.assign(partial, result);
    await save();
  }
}
const failures = report.runs.flatMap((run: any) => run.records).flatMap((record: any) => [
  record.foamError, record.rollingError, record.prepareError,
  ...(record.clients ?? []).map((client: any) => client.error ?? client.unavailable),
]).filter(Boolean);
report.protocolFailures = failures;
report.review = 'Ready for separate memory/context/client review. No numerical release threshold.';
await save();
console.log(`Saved ${path}; ${failures.length} protocol failures. Semantic review remains separate.`);
if (failures.length) process.exitCode = 1;
