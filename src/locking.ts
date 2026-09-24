import { mkdir, open, writeFile, rm, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';

export interface LockOwner { operationId: string; pid: number; host: string; started: string; }
const processIdentity = `${new Date(performance.timeOrigin).toISOString()}:${randomUUID()}`;

// All writer-lock creation, release and recovery is serialized by this short-lived
// gate. Never recover the gate automatically: that would recursively reintroduce
// the check-then-delete race. A crashed gate requires offline operator repair.
async function gated<T>(directory: string, action: () => Promise<T>, wait = false): Promise<T> {
  const gate = join(directory, '.coordination.lock');
  for (let attempt = 0; ; attempt++) {
    try { await mkdir(gate, { mode: 0o700 }); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (!wait || attempt >= 100) throw new Error('Scratchpad busy: coordination gate exists; retry, or verify all clients stopped before offline repair');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  try { return await action(); } finally { await rm(gate, { recursive: true }); }
}

export async function inspectWriter(directory: string): Promise<{ state: 'unlocked' | 'owned' | 'unknown'; owner?: LockOwner }> {
  const lock = join(directory, '.writer.lock');
  try { if (!(await lstat(lock)).isDirectory()) return { state: 'unknown' }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'unlocked' }; throw error; }
  try {
    const file = await open(join(lock, 'owner.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let owner: LockOwner;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 4096) return { state: 'unknown' };
      const buffer = Buffer.alloc(4097);
      let size = 0;
      while (size < buffer.length) { const part = await file.read(buffer, size, buffer.length - size, null); if (!part.bytesRead) break; size += part.bytesRead; }
      if (size > 4096) return { state: 'unknown' };
      owner = JSON.parse(buffer.subarray(0, size).toString('utf8')) as LockOwner;
    } finally { await file.close(); }
    if (typeof owner.operationId !== 'string' || !owner.operationId || !Number.isSafeInteger(owner.pid) || owner.pid < 1 || typeof owner.host !== 'string' || !owner.host || typeof owner.started !== 'string' || !owner.started) return { state: 'unknown' };
    return { state: 'owned', owner };
  } catch { return { state: 'unknown' }; }
}

export async function acquireWriter(directory: string, operationId: string): Promise<() => Promise<void>> {
  const owner: LockOwner = { operationId, pid: process.pid, host: hostname(), started: processIdentity };
  await gated(directory, async () => {
    const lock = join(directory, '.writer.lock');
    try { await mkdir(lock, { mode: 0o700 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Scratchpad busy: writer lock exists ${JSON.stringify(await inspectWriter(directory))}`);
      throw error;
    }
    // Interruption before owner publication deliberately leaves unknown ownership.
    await writeFile(join(lock, 'owner.json'), JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
  });
  return () => gated(directory, async () => {
    const current = await inspectWriter(directory);
    if (current.owner?.operationId !== owner.operationId) throw new Error('Writer ownership changed; lock retained');
    await rm(join(directory, '.writer.lock'), { recursive: true });
  }, true);
}

/** Explicit recovery, never an implicit retry or replay of the interrupted encounter. */
export async function recoverWriter(directory: string): Promise<{ recovered: boolean; operationId?: string; outcome: string }> {
  return gated(directory, async () => {
    const current = await inspectWriter(directory);
    if (current.state === 'unlocked') return { recovered: false, outcome: 'No writer lock' };
    if (!current.owner || current.owner.host !== hostname()) throw new Error('Unknown or foreign ownership: verify all clients stopped and repair offline');
    try { process.kill(current.owner.pid, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        await rm(join(directory, '.writer.lock'), { recursive: true });
        return { recovered: true, operationId: current.owner.operationId, outcome: 'Owner exited; commit outcome unknown. Inspect revision before deciding whether to retry.' };
      }
      throw new Error('Cannot establish owner liveness; lock retained');
    }
    // Refusing a reused live PID is conservative and avoids start-time granularity risks.
    throw new Error('Live owner (or reused live PID); lock retained');
  });
}
