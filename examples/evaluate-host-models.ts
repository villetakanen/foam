/** Local-provider smoke/evaluation through both host adapters; no account credentials. */
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { ModelRuntime, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { piInference } from '../dist/adapters/pi.js';
import { langGraphInference } from '../dist/adapters/langgraph.js';
import { INTERPRETER_PROMPT } from '../dist/index.js';
import { evaluateActivity, clientInstruction, summaryInstruction } from './activity-evaluation.js';
import { recollectionScenarios } from './recollection-fixtures.js';

const modelId = process.env.FOAM_HOST_MODEL ?? 'gemma4:e4b';
const path = process.env.FOAM_REPORT ?? '.foam/host-model-evaluation.json';
const endpoint = 'http://127.0.0.1:11434';
const tags = await (await fetch(endpoint + '/api/tags', { signal: AbortSignal.timeout(5000) })).json();
const installed = tags.models.find((entry: any) => entry.name === modelId && !entry.remote_model && !entry.remote_host);
if (!installed || modelId.endsWith('-cloud')) throw Error('Requires an installed local Ollama model');
const directory = await mkdtemp(join(tmpdir(), 'foam-host-models-'));
const report: any = { date: new Date().toISOString(), model: installed, instruction: INTERPRETER_PROMPT,
  clientInstruction, summaryInstruction: summaryInstruction(2048), calls: [], runs: [],
  limitations: ['Local provider only; not proof of compatibility with every provider or OAuth flow.',
    'Scripted experience and independent text probes; no real messaging transport or tool execution.',
    'Provider-neutral calls use host model settings; no forced JSON schema or temperature-zero requirement.'],
};
const save = async () => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(report, null, 2) + '\n'); };
try {
  const runtime = await ModelRuntime.create({ authPath: join(directory, 'auth.json'), modelsPath: null,
    modelsStorePath: join(directory, 'models.json'), refreshOnCreate: false });
  runtime.registerProvider('local-host', { baseUrl: endpoint + '/v1', authHeader: false, apiKey: 'local-no-auth', api: 'openai-completions',
    models: [{ id: modelId, name: modelId, reasoning: false, input: ['text'], contextWindow: 16384, maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] });
  const model = runtime.getModel('local-host', modelId)!;
  const registry = new ModelRegistry(runtime);
  let host = '';
  let scenarioId = '';
  const hostCall = async (context: Parameters<typeof registry.streamSimple>[1], signal: AbortSignal, maxTokens = 4096) => {
    const started = performance.now();
    const call: any = { host, scenario: scenarioId, context, maxTokens, maxRetries: 0 };
    report.calls.push(call);
    try {
      const result = await registry.streamSimple(model, context, { signal, maxTokens, maxRetries: 0 }).result();
      call.response = result;
      if (result.stopReason !== 'stop') throw Error(result.errorMessage ?? result.stopReason);
      return result;
    } catch (error) { call.error = String(error); throw error; }
    finally { call.latencyMs = performance.now() - started; }
  };
  // Pi's adapter receives the session registry; instrument calls without changing auth/provider behavior.
  const instrumented = Object.create(registry) as ModelRegistry;
  instrumented.streamSimple = (_model, context, options) => ({ result: () => hostCall(context, options?.signal ?? AbortSignal.timeout(60000), options?.maxTokens) }) as any;
  const adapters = {
    pi: piInference(() => ({ model, modelRegistry: instrumented })),
    langgraph: langGraphInference(async (messages, options) => {
      const result = await hostCall({ systemPrompt: messages[0]!.content,
        messages: [{ role: 'user', content: messages[1]!.content, timestamp: Date.now() }] }, options.signal, options.maxTokens);
      return { content: result.content.filter(p => p.type === 'text').map(p => p.text).join(''), response_metadata: { finish_reason: result.stopReason } };
    }, { describe: () => ({ provider: model.provider, model: model.id }) }),
  };
  for (const [name, inference] of Object.entries(adapters)) {
    host = name;
    for (const scenario of recollectionScenarios.slice(0, 2)) {
      scenarioId = scenario.id;
      const run: any = { host, scenario: scenario.id, records: [] };
      report.runs.push(run);
      await evaluateActivity({ scenario, inference, timeoutMs: 60000,
        text: async request => {
          const result = await hostCall({ systemPrompt: request.instruction,
            messages: [{ role: 'user', content: request.content, timestamp: Date.now() }] }, AbortSignal.timeout(60000));
          return result.content.filter(p => p.type === 'text').map(p => p.text).join('');
        }, onRecord: async record => { run.records.push(record); await save(); console.error(`${host}: ${scenario.id}: ${record.kind}`); } });
    }
  }
  report.failures = report.runs.flatMap((run: any) => run.records).flatMap((record: any) => [record.foamError, record.prepareError, record.rollingError,
    ...(record.clients ?? []).map((client: any) => client.error ?? client.unavailable)]).filter(Boolean);
  await save();
  console.log(`Saved ${path}; ${report.failures.length} protocol failures.`);
  if (report.failures.length) process.exitCode = 1;
} finally { await rm(directory, { recursive: true, force: true }); }
