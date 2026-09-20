import { constants } from 'node:fs';
import { mkdir, open, rename, rm, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { INTERPRETER_PROMPT } from './inference.js';
import type { Encounter, FoamOptions, InferenceInput, Observation, Result, Snapshot } from './types.js';

const byteLength = (text: string) => Buffer.byteLength(text, 'utf8');
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
    if (options.maxInputTokens !== undefined) {
      positive(options.maxInputTokens, 'maxInputTokens');
      if (!options.countTokens) throw new Error('maxInputTokens requires countTokens');
    }
  }
  private async read(): Promise<{ snapshot: Snapshot; hash: string }> {
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
  prepare(encounter: Encounter): Promise<Result> { return this.run('prepare', encounter); }
  observe(encounter: Observation): Promise<Result> { return this.run('observe', encounter); }

  private async run(operation: 'prepare' | 'observe', encounter: Encounter | Observation): Promise<Result> {
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
      if (observation.sourceRefs !== undefined && (!Array.isArray(observation.sourceRefs) || observation.sourceRefs.some(x => typeof x !== 'string'))) throw new Error('Invalid source references');
      if (observation.access && (observation.access.scope !== this.scope || !observation.access.id || !Number.isSafeInteger(observation.access.revision))) {
        throw new Error('Invalid or cross-scope access');
      }
    }
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if ((await lstat(this.directory)).isSymbolicLink()) throw new Error('Scratchpad directory must not be a symlink');
    const lock = join(this.directory, '.writer.lock');
    try { await mkdir(lock, { mode: 0o700 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Scratchpad busy: writer lock exists');
      throw error;
    }
    const temp = join(this.directory, `.memory-${randomUUID()}.tmp`);
    try {
      const before = await this.read();
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
      const controller = new AbortController();
      const started = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Inference timeout')); }, this.limits.timeoutMs);
      });
      let output: unknown;
      try {
        // Copy isolates model adapters from mutating revision/scope state used for the commit.
        output = await Promise.race([Promise.resolve().then(() => this.options.inference.infer(structuredClone(input), controller.signal)), timeout]);
      } finally { clearTimeout(timer); }
      if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error('Invalid interpreter response');
      const proposal = output as Record<string, unknown>;
      if (Object.keys(proposal).sort().join(',') !== 'context,markdown' || typeof proposal.markdown !== 'string' || typeof proposal.context !== 'string') throw new Error('Invalid interpreter schema');
      if (byteLength(proposal.markdown) > this.limits.memoryBytes || byteLength(proposal.context) > this.limits.contextBytes) throw new Error('Interpreter output exceeds budget');
      const after = await this.read();
      if (after.hash !== before.hash) throw new Error('Scratchpad changed during inference');
      const revision = before.snapshot.revision + 1;
      if (!Number.isSafeInteger(revision)) throw new Error('Revision exhausted');
      const raw = `---\nscope: ${JSON.stringify(this.scope)}\nrevision: ${revision}\n---\n${proposal.markdown}`;
      const file = await open(temp, 'wx', 0o600);
      try { await file.writeFile(raw, 'utf8'); await file.sync(); } finally { await file.close(); }
      await rename(temp, join(this.directory, 'memory.md'));
      return {
        scope: this.scope, revision, markdown: proposal.markdown, context: proposal.context,
        access: { id: randomUUID(), scope: this.scope, revision, occurrence: encounter.occurrence },
        metrics: { inferenceCalls: 1, latencyMs: performance.now() - started, inputBytes,
          ...(inputTokens !== undefined ? { inputTokens } : {}), contextBytes: byteLength(proposal.context) },
      };
    } finally {
      await rm(temp, { force: true });
      await rm(lock, { recursive: true });
    }
  }
}
