import { constants } from 'node:fs';
import { mkdir, open, rename, rm, lstat } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { INTERPRETER_PROMPT } from './inference.js';
import { validateInterpretation } from './response.js';
import { acquireWriter, inspectWriter, recoverWriter } from './locking.js';
import { appendTrace, readTrace } from './diagnostics.js';
import type { DiagnosticRecord, Encounter, FoamOptions, InferenceInput, Observation, Result, Snapshot } from './types.js';

const byteLength = (text: string) => Buffer.byteLength(text, 'utf8');
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const positive = (value: number, name: string) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
};
export class Foam {
  readonly directory: string;
  readonly scope: string;
  private readonly limits;
  constructor(private readonly options: FoamOptions) {
    if (!options.scope || options.scope.length > 256 || /[\r\n]/.test(options.scope)) throw new Error('Invalid scope');
    this.directory = resolve(options.directory);
    this.scope = options.scope;
    this.limits = {
      memoryBytes: positive(options.maxMemoryBytes ?? 12288, 'maxMemoryBytes'),
      inputBytes: positive(options.maxInputBytes ?? 20480, 'maxInputBytes'),
      contextBytes: positive(options.maxContextBytes ?? 2048, 'maxContextBytes'),
      timeoutMs: positive(options.timeoutMs ?? 30000, 'timeoutMs'),
    };
    if (options.trace) {
      positive(options.trace.maxBytes, 'trace.maxBytes');
      positive(options.trace.maxRecords, 'trace.maxRecords');
      if (options.trace.maxBytes > 16 * 1024 * 1024 || options.trace.maxRecords > 10000) throw new Error('Trace limits exceed hard bounds');
    }
    if (options.maxTotalTokens !== undefined || options.outputTokenReserve !== undefined) {
      positive(options.maxTotalTokens ?? 0, 'maxTotalTokens');
      positive(options.outputTokenReserve ?? 0, 'outputTokenReserve');
      if (!options.countTokens) throw new Error('Total token budget requires countTokens');
    }
    if (options.directoryRoot && (!relative(resolve(options.directoryRoot), this.directory) || relative(resolve(options.directoryRoot), this.directory).startsWith('..'))) throw new Error('Directory escapes project root');
    if (options.maxInputTokens !== undefined) {
      positive(options.maxInputTokens, 'maxInputTokens');
      if (!options.countTokens) throw new Error('maxInputTokens requires countTokens');
    }
  }
  private async validateDirectory() {
    try { if ((await lstat(this.directory)).isSymbolicLink()) throw new Error('Scratchpad directory must not be a symlink'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!this.options.directoryRoot) return;
    let path = resolve(this.options.directoryRoot);
    for (const part of relative(path, this.directory).split(sep)) {
      path = join(path, part);
      try { const stat = await lstat(path); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Project memory path must contain only real directories'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  private async read(): Promise<{ snapshot: Snapshot; hash: string }> {
    await this.validateDirectory();
    const path = join(this.directory, 'memory.md');
    let raw: string;
    try {
      const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > this.limits.memoryBytes + 2048) throw new Error('Invalid or oversized scratchpad');
        // Fixed-size read also bounds a file that grows after stat().
        const buffer = Buffer.alloc(this.limits.memoryBytes + 2049);
        let length = 0;
        while (length < buffer.length) {
          const part = await file.read(buffer, length, buffer.length - length, null);
          if (!part.bytesRead) break;
          length += part.bytesRead;
        }
        if (length === buffer.length) throw new Error('Oversized scratchpad');
        raw = buffer.subarray(0, length).toString('utf8');
        if (!Buffer.from(raw).equals(buffer.subarray(0, length))) throw new Error('Scratchpad is not valid UTF-8');
      } finally { await file.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { snapshot: { scope: this.scope, revision: 0, markdown: '' }, hash: digest('') };
      }
      throw error;
    }
    const match = /^---\nscope: ("[^\n]*")\nrevision: (\d+)\n---\n([\s\S]*)$/.exec(raw);
    if (!match) throw new Error('Malformed scratchpad frontmatter');
    const scope: unknown = JSON.parse(match[1]!);
    const revision = Number(match[2]);
    if (scope !== this.scope) throw new Error('Scratchpad scope mismatch');
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Invalid scratchpad revision');
    const markdown = match[3]!;
    if (byteLength(markdown) > this.limits.memoryBytes) throw new Error('Scratchpad exceeds memory budget');
    return { snapshot: { scope: this.scope, revision, markdown }, hash: digest(raw) };
  }
  async inspect(): Promise<Snapshot> { return (await this.read()).snapshot; }
  async status() {
    const snapshot = await this.inspect();
    const diagnosticLoss: string[] = [];
    let trace: DiagnosticRecord[] = [];
    if (this.options.trace) {
      try { trace = (await readTrace(this.directory, this.options.trace.maxBytes)).slice(-this.options.trace.maxRecords); }
      catch (error) { diagnosticLoss.push(`Local diagnostics unreadable: ${errorMessage(error)}`); }
    }
    let coordinationGate = false;
    try { await lstat(join(this.directory, '.coordination.lock')); coordinationGate = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return { snapshot, directory: this.directory, writer: await inspectWriter(this.directory), coordinationGate, trace, diagnosticLoss };
  }
  async recover() { await this.validateDirectory(); await mkdir(this.directory, { recursive: true, mode: 0o700 }); return recoverWriter(this.directory); }
  private async diagnose(record: DiagnosticRecord, losses: string[], local: boolean) {
    if (this.options.diagnostics) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([Promise.resolve().then(() => this.options.diagnostics!(structuredClone(record))),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Diagnostics sink timed out')), 1000); })]);
      } catch (error) { losses.push(`Host diagnostics lost: ${errorMessage(error)}`); }
      finally { clearTimeout(timer); }
    }
    if (this.options.trace && local) {
      try { await appendTrace(this.directory, record, this.options.trace); }
      catch (error) { losses.push(`Local diagnostics lost: ${errorMessage(error)}`); }
    } else if (this.options.trace) losses.push('Local diagnostics unavailable: writer lock not held');
  }
  prepare(encounter: Encounter): Promise<Result> { return this.run('prepare', encounter); }
  observe(encounter: Observation): Promise<Result> { return this.run('observe', encounter); }

  private async run(operation: 'prepare' | 'observe', encounter: Encounter | Observation): Promise<Result> {
    encounter = structuredClone(encounter);
    const operationId = randomUUID();
    const operationStarted = performance.now();
    const losses: string[] = [];
    const record: DiagnosticRecord = { operationId, scope: this.scope, phase: operation,
      timestamp: new Date().toISOString(), durationMs: 0, outcome: 'failed',
      ...(encounter.correlationId !== undefined ? { correlationId: encounter.correlationId } : {}) };
    let release: (() => Promise<void>) | undefined;
    let result: Result | undefined;
    const temp = join(this.directory, `.memory-${operationId}.tmp`);
    try {
      if (encounter.correlationId !== undefined && (typeof encounter.correlationId !== 'string' || encounter.correlationId.length > 256)) throw new Error('Invalid correlation ID');
      if (encounter.sourceRefs !== undefined && (!Array.isArray(encounter.sourceRefs) || encounter.sourceRefs.length > 64 || encounter.sourceRefs.some(x => typeof x !== 'string' || x.length > 1024))) throw new Error('Invalid source references');
      if (encounter.recentExchange !== undefined) {
        if (!Array.isArray(encounter.recentExchange) || encounter.recentExchange.length > 32 || Buffer.byteLength(JSON.stringify(encounter.recentExchange)) > 8192 || encounter.recentExchange.some(x => !x || !['user', 'assistant', 'tool'].includes(x.role) || typeof x.text !== 'string' || (x.sourceRef !== undefined && typeof x.sourceRef !== 'string'))) throw new Error('Invalid or oversized recent exchange');
      }
      if (typeof encounter.cue !== 'string' || typeof encounter.occurrence !== 'string' || !encounter.occurrence) {
        throw new Error('Cue and nonempty occurrence are required');
      }
      if (encounter.expectedRevision !== undefined && (!Number.isSafeInteger(encounter.expectedRevision) || encounter.expectedRevision < 0)) {
        throw new Error('Invalid expected revision');
      }
      if (operation === 'observe') {
        const observation = encounter as Observation;
        if (!Array.isArray(observation.observations) || observation.observations.some(x => typeof x !== 'string')) throw new Error('Invalid observations');
        if (observation.suppliedContext !== undefined && typeof observation.suppliedContext !== 'string') throw new Error('Invalid supplied context');
        if (observation.access && (observation.access.scope !== this.scope || typeof observation.access.id !== 'string' || !observation.access.id || !Number.isSafeInteger(observation.access.revision) || observation.access.revision < 1 || typeof observation.access.occurrence !== 'string')) {
          throw new Error('Invalid or cross-scope access');
        }
      }
      await this.validateDirectory();
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      await this.validateDirectory();
      if ((await lstat(this.directory)).isSymbolicLink()) throw new Error('Scratchpad directory must not be a symlink');
      release = await acquireWriter(this.directory, operationId);
      const before = await this.read();
      record.beforeRevision = before.snapshot.revision;
      const observation = encounter as Observation;
      if (observation.suppliedContext !== undefined) {
        await this.diagnose({ ...record, operationId: observation.access?.id ?? operationId, phase: 'supply', outcome: 'supplied',
          ...(this.options.diagnosticDetails ? { details: { suppliedContext: observation.suppliedContext } } : {}) }, losses, true);
      }
      if (encounter.expectedRevision !== undefined && encounter.expectedRevision !== before.snapshot.revision) throw new Error('Revision conflict');
      const access = (encounter as Observation).access;
      if (access && access.revision > before.snapshot.revision) throw new Error('Access references a future revision');
      const input: InferenceInput = {
        instruction: INTERPRETER_PROMPT, operation, memory: before.snapshot, encounter,
        limits: { memoryBytes: this.limits.memoryBytes, contextBytes: this.limits.contextBytes },
      };
      const serialized = JSON.stringify(input);
      const inputBytes = byteLength(serialized);
      if (inputBytes > this.limits.inputBytes) throw new Error('Analysis input exceeds byte budget');
      const inputTokens = this.options.countTokens?.(serialized);
      if (inputTokens !== undefined && (!Number.isSafeInteger(inputTokens) || inputTokens < 0)) throw new Error('Invalid token count');
      if (inputTokens !== undefined && this.options.maxInputTokens !== undefined && inputTokens > this.options.maxInputTokens) throw new Error('Analysis input exceeds token budget');
      if (inputTokens !== undefined && this.options.maxTotalTokens !== undefined && inputTokens + this.options.outputTokenReserve! > this.options.maxTotalTokens) throw new Error('Analysis plus output reserve exceeds token budget');
      const controller = new AbortController();
      const started = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Inference timeout')); }, this.limits.timeoutMs);
      });
      let output: unknown;
      try {
        // Copy isolates model adapters from mutating revision/scope state used for the commit.
        output = await Promise.race([Promise.resolve().then(() => this.options.inference.infer(structuredClone(input), controller.signal, metadata => { record.normalized = metadata.normalized; })), timeout]);
      } finally { clearTimeout(timer); }
      const proposal = validateInterpretation(output);
      if (byteLength(proposal.markdown) > this.limits.memoryBytes || byteLength(proposal.context) > this.limits.contextBytes) throw new Error('Interpreter output exceeds budget');
      const after = await this.read();
      if (after.hash !== before.hash) throw new Error('Scratchpad changed during inference');
      const revision = before.snapshot.revision + 1;
      if (!Number.isSafeInteger(revision)) throw new Error('Revision exhausted');
      const raw = `---\nscope: ${JSON.stringify(this.scope)}\nrevision: ${revision}\n---\n${proposal.markdown}`;
      const file = await open(temp, 'wx', 0o600);
      try { await file.writeFile(raw, 'utf8'); await file.sync(); } finally { await file.close(); }
      await rename(temp, join(this.directory, 'memory.md'));
      record.outcome = 'committed';
      record.afterRevision = revision;
      if (this.options.diagnosticDetails) record.details = { before: before.snapshot.markdown, after: proposal.markdown };
      result = {
        scope: this.scope, revision, markdown: proposal.markdown, context: proposal.context,
        access: { id: operationId, scope: this.scope, revision, occurrence: encounter.occurrence },
        metrics: { inferenceCalls: 1, latencyMs: performance.now() - started, inputBytes,
          ...(inputTokens !== undefined ? { inputTokens } : {}), contextBytes: byteLength(proposal.context) },
      };
    } catch (error) {
      record.failureReason = errorMessage(error);
      throw error;
    } finally {
      record.durationMs = performance.now() - operationStarted;
      await this.diagnose(record, losses, !!release);
      if (release) {
        try { await rm(temp, { force: true }); }
        catch (error) { losses.push(`Temporary file cleanup incomplete: ${errorMessage(error)}`); }
        try { await release(); }
        catch (error) { losses.push(`Cleanup incomplete; inspect writer status: ${errorMessage(error)}`); }
      }
      if (result && losses.length) result.diagnosticLoss = losses;
      if (!result && losses.length && record.failureReason) {
        // Preserve the original failure while exposing diagnostic loss to callers.
        throw new Error(`${record.failureReason}; ${losses.join('; ')}`);
      }
    }
    return result!;
  }
}
