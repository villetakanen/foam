import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir, cpus, totalmem } from 'node:os';
import { join, dirname } from 'node:path';
import { Foam, decodeInterpretation, interpretationSchema } from '../dist/index.js';
import type { InferenceAdapter, InferenceInput } from '../dist/index.js';

// Local-only, explicit model; never downloads or falls back to another backend.
const model = process.env.FOAM_MODEL;
if (!model) throw new Error('Set FOAM_MODEL to an installed local Ollama model');
const trials = Number(process.env.FOAM_TRIALS ?? 20);
const sequences = Number(process.env.FOAM_SEQUENCES ?? 10);
if (![trials, sequences].every(x => Number.isSafeInteger(x) && x >= 1 && x <= 20)) throw new Error('Trial and sequence counts must be 1–20');
const baseline = process.env.FOAM_POLICY === '0.1';
const oldPrompt = (await readFile(new URL('../tests/fixtures/inference-0.1.ts.txt', import.meta.url), 'utf8')).match(/INTERPRETER_PROMPT = `([\s\S]*?)`;/)![1]!;
const hostTask = 'Draft a note update; execution and confirmation are owned by the host. No note tool has executed.';
const seed = '# Radiator purchase\nNeri H6 is a water radiator: width 710 mm, height 880 mm, pipe centres 590 mm. Wall opening: 760 mm wide. Order pending.\n# Sensors\nMira is investigating the shed sensor; older reading was 13 C.\n# Ferry\nMira is planning a ferry booking for Friday.\n';
const reportPath = process.env.FOAM_REPORT ?? '.foam/semantic-evaluation.json';
const calls: any[] = [];
const records: any[] = [];
const backend: InferenceAdapter = { async infer(input, signal, metadata) {
  const start = performance.now();
  const instruction = baseline && !input.instruction.startsWith('You are the responding') ? oldPrompt : input.instruction;
  const request = { model, stream: false, think: false, format: interpretationSchema,
    options: { temperature: 0, seed: 42, num_ctx: 16384, num_predict: 4096 },
    messages: [{ role: 'system', content: instruction }, { role: 'user', content: JSON.stringify({ ...input, instruction: undefined }) }] };
  const call: any = { operation: input.operation, inputBytes: Buffer.byteLength(JSON.stringify(request)) };
  calls.push(call);
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    if (!response.ok) throw new Error(`Local inference HTTP ${response.status}`);
    if (!response.body) throw new Error('Missing response body');
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = response.body.getReader();
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 262144) throw new Error('Response over budget'); chunks.push(part.value); } }
    finally { await reader.cancel(); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    call.raw = body.message?.content;
    call.inputTokens = body.prompt_eval_count; call.outputTokens = body.eval_count;
    call.loadMs = body.load_duration / 1e6;
    call.outputBytes = Buffer.byteLength(body.message?.content ?? '');
    if (!body.done || body.done_reason !== 'stop') throw new Error('Incomplete model response');
    const decoded = decodeInterpretation(body.message.content);
    metadata?.({ normalized: decoded.normalized });
    return decoded.interpretation;
  } catch (error) { call.error = String(error); throw error; }
  finally { call.latencyMs = performance.now() - start; }
} };
const version = await (await fetch('http://127.0.0.1:11434/api/version')).json();
const installed = await (await fetch('http://127.0.0.1:11434/api/tags')).json();
const modelInfo = installed.models.find((entry: any) => entry.name === model);
if (!modelInfo) throw new Error('Model must already be installed; no implicit download');
const report: any = { date: new Date().toISOString(), model, modelInfo, runtime: version,
  hardware: { cpu: cpus()[0]?.model, memoryBytes: totalmem(), platform: process.platform, arch: process.arch },
  policy: baseline ? '0.1' : '0.2', settings: { temperature: 0, seed: 42, think: false, num_ctx: 16384, num_predict: 4096 },
  rubric: 'docs/releases/0.2.0-rubric.md', hostTask, records, calls, scores: 'Unscored: human review required',
  limits: ['Provider token counts describe actual inputs; no portable tokenizer preflight is claimed.', 'First call may load a model; load duration recorded separately.', 'Synthetic text-only client; no actual external action.'] };
const save = async () => { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); };
async function run(family: string, trial: number, repeats: number) {
  const directory = await mkdtemp(join(tmpdir(), 'foam-semantic-'));
  try {
    let markdown = family === 'large' ? await readFile(new URL('../tests/fixtures/large-memory.md', import.meta.url), 'utf8') + seed : seed;
    if (family === 'completion') markdown = markdown.replace('Order pending.', 'Order and installation explicitly completed. No work remains.');
    if (family === 'radiator' && trial % 5 === 1) markdown += '\nA second water radiator, Neri J2, is 500 mm wide; neither has been selected for the note.\n';
    await writeFile(join(directory, 'memory.md'), `---\nscope: "synthetic"\nrevision: 1\n---\n${markdown}`);
    for (let access = 0; access < repeats; access++) {
      // Re-open on each access to exercise process-independent persistence.
      const foam = new Foam({ directory, scope: 'synthetic', inference: backend, timeoutMs: 60000, maxInputBytes: 30000 });
      const cue = family === 'completion' ? 'The old reminder says buy the radiator. What now?' :
        family === 'drift' && access % 2 ? 'Back to the ferry booking.' :
        family === 'radiator' && trial % 5 === 1 ? 'Update that one.' :
        family === 'radiator' && trial % 5 === 2 ? 'Correction: H6 is 720 mm wide, not 710. Update the note with that.' :
        family === 'radiator' && trial % 5 === 3 ? 'Only the order is complete; installation remains. Update the note.' :
        family === 'radiator' && trial % 5 === 4 ? 'The radiator has not been ordered. Update the note.' : 'Update the note with that.';
      const recentExchange = family === 'radiator' && trial % 5 === 0 ? [{ role: 'user' as const, text: 'Neri H6 is a water radiator, 710 mm wide, 880 mm high, with 590 mm pipe centres.' }] : [];
      const encounter = { cue, occurrence: `${family}-${trial}-${access}`, recentExchange };
      const record: any = { family, trial, access, encounter, before: await foam.inspect(), clients: [], scores: null };
      records.push(record);
      try {
        const prepared = await foam.prepare(encounter);
        record.prepared = prepared;
        for (const condition of ['enabled', 'disabled']) {
          const input: InferenceInput = { instruction: 'You are the responding client. Answer the user using fallible supplied context and host task state. Do not claim an unexecuted tool action. Return JSON with markdown empty and context your reply.',
            operation: 'prepare', memory: { scope: 'synthetic', revision: 0, markdown: condition === 'enabled' ? prepared.context : '' },
            encounter: { ...encounter, cue: `${cue}\nHost task: ${hostTask}` }, limits: { memoryBytes: 12288, contextBytes: 2048 } };
          try { record.clients.push({ condition, response: await backend.infer(input, AbortSignal.timeout(60000)) }); }
          catch (error) { record.clients.push({ condition, error: String(error) }); }
        }
        record.observed = await foam.observe({ ...encounter, expectedRevision: prepared.revision, access: prepared.access,
          suppliedContext: prepared.context, observations: ['Context was supplied to the text-only client; no note tool was executed.'] });
      } catch (error) { record.error = String(error); }
      record.after = await foam.inspect();
      await save();
      console.error(`${family} trial ${trial + 1}, access ${access + 1}: ${record.error ?? 'recorded; requires semantic review'}`);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
}
for (const family of ['radiator', 'completion']) for (let trial = 0; trial < trials; trial++) await run(family, trial, 1);
for (let trial = 0; trial < sequences; trial++) await run('drift', trial, 10);
await run('large', 0, 1);
const percentile = (values: number[], p: number) => values.sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
report.latency = { firstCallMs: calls[0]?.latencyMs, calls: calls.length,
  ...Object.fromEntries(['prepare', 'observe'].map(phase => {
    const samples = records.flatMap(record => { const result = phase === 'prepare' ? record.prepared : record.observed; return result ? [result.metrics.latencyMs] : []; }).slice(1);
    return [phase, { count: samples.length, p50: percentile([...samples], .5), p95: percentile([...samples], .95) }];
  })) };
await save();
if (records.some(record => record.error || record.clients.some((client: any) => client.error))) process.exitCode = 1;
console.log(`Saved ${reportPath}. Unscored records are not semantic passes.`);
