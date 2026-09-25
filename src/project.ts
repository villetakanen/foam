import { constants } from 'node:fs';
import { mkdir, open, lstat, readFile, writeFile, realpath, rename, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Foam } from './core.js';
import { jsonInference } from './inference.js';
import { acquireWriter } from './locking.js';
import type { FoamOptions, InferenceAdapter } from './types.js';

export interface ProjectConfig {
  version: 1;
  policyVersion: '0.2';
  memoryRoot: string;
  scopes: Record<string, { directory: string; scope?: string }>;
  budgets?: { maxMemoryBytes?: number; maxInputBytes?: number; maxContextBytes?: number; timeoutMs?: number };
  inference?: { endpoint: string; model: string; apiKeyEnv?: string; maxOutputTokens?: number };
  trace?: { maxBytes: number; maxRecords: number };
}
const keys = (value: unknown, allowed: string[], required: string[] = []) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project configuration object');
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some(key => !allowed.includes(key)) || required.some(key => !(key in object))) throw new Error('Unknown or missing project configuration field');
  return object;
};
const positiveValues = (object: Record<string, unknown>) => {
  for (const value of Object.values(object)) if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('Invalid configuration budget');
};
const childPath = (root: string, path: string) => {
  if (typeof path !== 'string' || !path || /[\x00-\x1f\x7f*?\[\]\\]/.test(path) || isAbsolute(path) || path.split(/[\\/]/).some(x => !x || x === '..' || x === '.')) throw new Error('Expected a nonempty relative child directory');
  const result = resolve(root, path);
  if (!relative(root, result) || relative(root, result).startsWith('..' + sep)) throw new Error('Directory escapes configured root');
  return result;
};
async function noSymlinks(root: string, target: string) {
  let current = root;
  for (const part of relative(root, target).split(sep)) {
    current = join(current, part);
    try { const stat = await lstat(current); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Project memory path must contain only real directories'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
export async function readProjectConfig(projectRoot: string): Promise<ProjectConfig> {
  const file = await open(join(resolve(projectRoot), 'foam.config.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
  let parsed: unknown;
  try {
    const buffer = Buffer.alloc(65537);
    let size = 0;
    while (size < buffer.length) { const part = await file.read(buffer, size, buffer.length - size, null); if (!part.bytesRead) break; size += part.bytesRead; }
    if (size > 65536) throw new Error('Project configuration exceeds 64 KiB');
    parsed = JSON.parse(buffer.subarray(0, size).toString('utf8'));
  } finally { await file.close(); }
  const config = keys(parsed, ['version', 'policyVersion', 'memoryRoot', 'scopes', 'budgets', 'inference', 'trace'], ['version', 'policyVersion', 'memoryRoot', 'scopes']);
  if (config.version !== 1 || config.policyVersion !== '0.2') throw new Error('Unsupported configuration or policy version');
  const root = childPath(resolve(projectRoot), config.memoryRoot as string);
  const scopes = config.scopes;
  if (!scopes || typeof scopes !== 'object' || Array.isArray(scopes) || !Object.keys(scopes).length) throw new Error('Declare at least one scope');
  const paths: string[] = [];
  const labels = new Set<string>();
  for (const [name, value] of Object.entries(scopes)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name)) throw new Error('Invalid scope name');
    const scope = keys(value, ['directory', 'scope'], ['directory']);
    const label = scope.scope ?? name;
    if (typeof label !== 'string' || !label || label.length > 256 || /[\r\n]/.test(label) || labels.has(label)) throw new Error('Invalid or aliased scope label');
    labels.add(label);
    const path = childPath(root, scope.directory as string);
    if (paths.some(other => path.toLowerCase() === other.toLowerCase() || path.toLowerCase().startsWith(other.toLowerCase() + sep) || other.toLowerCase().startsWith(path.toLowerCase() + sep))) throw new Error('Aliased or nested scope directories');
    paths.push(path);
    await noSymlinks(resolve(projectRoot), path);
  }
  if (config.budgets !== undefined) positiveValues(keys(config.budgets, ['maxMemoryBytes', 'maxInputBytes', 'maxContextBytes', 'timeoutMs']));
  if (config.trace !== undefined) positiveValues(keys(config.trace, ['maxBytes', 'maxRecords'], ['maxBytes', 'maxRecords']));
  if (config.inference !== undefined) {
    const inference = keys(config.inference, ['endpoint', 'model', 'apiKeyEnv', 'maxOutputTokens'], ['endpoint', 'model']);
    if (typeof inference.endpoint !== 'string' || typeof inference.model !== 'string' || (inference.apiKeyEnv !== undefined && (typeof inference.apiKeyEnv !== 'string' || !/^[A-Z_][A-Z0-9_]*$/i.test(inference.apiKeyEnv)))) throw new Error('Invalid inference configuration');
    if (inference.maxOutputTokens !== undefined) positiveValues({ maxOutputTokens: inference.maxOutputTokens });
    const endpoint = new URL(inference.endpoint);
    if ([...endpoint.searchParams.keys()].some(key => /key|token|secret|password|authorization/i.test(key))) throw new Error('Reference credential environment variables instead of URL credentials');
    jsonInference({ endpoint: inference.endpoint, model: inference.model });
  }
  return parsed as ProjectConfig;
}

export async function projectStatus(projectRoot: string, scope: string) {
  const root = await realpath(resolve(projectRoot));
  const config = await readProjectConfig(root);
  if (!Object.hasOwn(config.scopes, scope)) throw new Error('Scope is not declared by this project');
  const binding = config.scopes[scope]!;
  return { config, configuration: join(root, 'foam.config.json'), directory: childPath(childPath(root, config.memoryRoot), binding.directory), scope: binding.scope ?? scope,
    backend: config.inference ? { endpoint: config.inference.endpoint, model: config.inference.model } : 'host or injected adapter required' };
}

export async function openProjectMemory(options: { projectRoot: string; scope: string; inference?: InferenceAdapter;
  hostInference?: InferenceAdapter;
  diagnostics?: FoamOptions['diagnostics']; diagnosticDetails?: boolean }): Promise<Foam> {
  const status = await projectStatus(options.projectRoot, options.scope);
  let inference = options.inference;
  if (!inference && status.config.inference) {
    const { apiKeyEnv, ...backend } = status.config.inference;
    const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : undefined;
    if (apiKeyEnv && !apiKey) throw new Error(`Missing credential environment variable ${apiKeyEnv}`);
    inference = jsonInference({ ...backend, ...(apiKey ? { apiKey } : {}) });
  }
  const source = options.inference ? 'explicit' : inference ? 'project' : 'host';
  inference ??= options.hostInference;
  if (!inference) throw new Error('Inject inference, supply host inference, or configure a project backend');
  const selected = inference;
  const describe = () => ({ ...selected.describe?.(), source,
    ...(source === 'project' ? { model: status.config.inference!.model } : {}) });
  inference = { describe, async infer(input, signal, diagnostics) {
    diagnostics?.({ backend: describe() });
    return selected.infer(input, signal, metadata => diagnostics?.({ ...metadata,
      ...(metadata.backend ? { backend: { ...metadata.backend, source } } : {}) }));
  } };
  return new Foam({ directory: status.directory, directoryRoot: await realpath(resolve(options.projectRoot)), scope: status.scope, inference, ...status.config.budgets,
    ...(status.config.trace ? { trace: status.config.trace } : {}),
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
    ...(options.diagnosticDetails !== undefined ? { diagnosticDetails: options.diagnosticDetails } : {}) });
}

export async function initializeProject(projectRoot: string, scope = 'private') {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(scope)) throw new Error('Invalid scope name');
  const root = await realpath(resolve(projectRoot));
  const path = join(root, 'foam.config.json');
  const config: ProjectConfig = { version: 1, policyVersion: '0.2', memoryRoot: '.foam', scopes: { [scope]: { directory: scope } } };
  try { await writeFile(path, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  const existing = await readProjectConfig(root);
  const ignorePath = join(root, '.gitignore');
  const file = await open(ignorePath, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_APPEND, 0o644);
  try {
    const ignored = await file.readFile('utf8');
    const rule = `/${existing.memoryRoot}/`;
    if (!ignored.split(/\r?\n/).includes(rule)) await file.writeFile(`${ignored && !ignored.endsWith('\n') ? '\n' : ''}${rule}\n`);
  } finally { await file.close(); }
  return existing;
}

/** Offline copy under both writer locks. The old directory is never deleted or revised. */
export async function migrateMemory(options: { sourceDirectory: string; projectRoot: string; scope: string }) {
  const target = await projectStatus(options.projectRoot, options.scope);
  const inference: InferenceAdapter = { async infer() { throw new Error('Migration never infers'); } };
  const source = new Foam({ directory: options.sourceDirectory, scope: target.scope, inference, ...target.config.budgets });
  const destination = new Foam({ directory: target.directory, directoryRoot: await realpath(resolve(options.projectRoot)), scope: target.scope, inference, ...target.config.budgets });
  await mkdir(target.directory, { recursive: true, mode: 0o700 });
  const sourcePath = await realpath(source.directory);
  const targetPath = await realpath(target.directory);
  if (sourcePath === targetPath) return { migrated: false, snapshot: await source.inspect() };
  const releaseSource = await acquireWriter(sourcePath, randomUUID());
  try {
    const releaseTarget = await acquireWriter(targetPath, randomUUID());
    try {
      const snapshot = await source.inspect();
      if (!snapshot.revision) throw new Error('Source memory does not exist');
      if ((await destination.inspect()).revision) throw new Error('Destination already contains memory');
      const raw = `---\nscope: ${JSON.stringify(snapshot.scope)}\nrevision: ${snapshot.revision}\n---\n${snapshot.markdown}`;
      const temp = join(targetPath, `.migration-${randomUUID()}.tmp`);
      try {
        const file = await open(temp, 'wx', 0o600);
        try { await file.writeFile(raw); await file.sync(); } finally { await file.close(); }
        await rename(temp, join(targetPath, 'memory.md'));
      } finally { await rm(temp, { force: true }); }
      const verified = await destination.inspect();
      if (JSON.stringify(snapshot) !== JSON.stringify(verified)) throw new Error('Migration verification failed; source retained');
      return { migrated: true, snapshot: verified };
    } finally { await releaseTarget(); }
  } finally { await releaseSource(); }
}
