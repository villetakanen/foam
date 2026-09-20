import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Foam, inferenceFromEnv } from '../dist/index.js';
import { cues } from './fixture.js';

// This is an inspectable behaviour probe, not an automated claim of cognitive quality.
const backend = inferenceFromEnv();
let outputs: unknown[] = [];
const inference: typeof backend = { async infer(input, signal) {
  const output = await backend.infer(input, signal);
  outputs.push({ operation: input.operation, output });
  return output;
} };
const trials = Number(process.env.FOAM_TRIALS ?? 3);
if (!Number.isInteger(trials) || trials < 1 || trials > 20) throw new Error('FOAM_TRIALS must be 1–20');
const baseline = 'Alex is waiting for the plumber appointment to fix the leaking sink.';
const report: any = { date: new Date().toISOString(), model: process.env.FOAM_MODEL,
  endpointKind: new URL(process.env.FOAM_ENDPOINT!).hostname === '127.0.0.1' ? 'local' : 'configured',
  method: 'Repeated synthetic sequence; unchanged compact-note baseline. Full traces retained for human assessment. No automatic quality score.',
  limitations: ['One small scenario family', 'Baseline intentionally has no update mechanism', 'No proof of biological fidelity or superiority'],
  trials: [] };
for (let trial = 0; trial < trials; trial++) {
  const directory = await mkdtemp(join(tmpdir(), 'foam-live-'));
  const records: any[] = [];
  try {
    const foam = new Foam({ directory, scope: 'synthetic:alex', inference,
      timeoutMs: Number(process.env.FOAM_TIMEOUT_MS ?? 30000) });
    for (const [i, cue] of cues.entries()) {
      const started = performance.now();
      outputs = [];
      try {
        const result = await foam.prepare({ cue, occurrence: `trial-${trial}-encounter-${i}` });
        const observed = await foam.observe({ cue, occurrence: result.access.occurrence,
          access: result.access, suppliedContext: result.context,
          observations: ['The evaluation client displayed the supplied context. No physical action was taken.'] });
        records.push({ cue, interpreterOutputs: outputs, context: result.context, markdown: result.markdown, afterExposure: observed.markdown,
          metrics: result.metrics, observationMetrics: observed.metrics, baselineContext: baseline,
          baselineContextBytes: Buffer.byteLength(baseline), baselineInferenceCalls: 0 });
        console.error(`Trial ${trial + 1}, encounter ${i + 1}: ${result.metrics.contextBytes} bytes, ${Math.round(performance.now() - started)} ms`);
      } catch (error) {
        records.push({ cue, interpreterOutputs: outputs, error: (error as Error).message, latencyMs: performance.now() - started,
          preservedSnapshot: await foam.inspect() });
        console.error(`Trial ${trial + 1}, encounter ${i + 1}: ${(error as Error).message}`);
      }
    }
    report.trials.push({ trial: trial + 1, records, final: await foam.inspect() });
  } finally { await rm(directory, { recursive: true, force: true }); }
}
const path = process.env.FOAM_REPORT ?? '.foam/live-evaluation.json';
await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log(`Live evaluation written to ${path}. Review unsupported changes and stale-action implications manually.`);
if (report.trials.some((trial: any) => trial.records.some((record: any) => record.error))) process.exitCode = 1;
