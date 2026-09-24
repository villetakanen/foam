import { open, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DiagnosticRecord } from './types.js';

export async function readTrace(directory: string, maxBytes: number): Promise<DiagnosticRecord[]> {
  let file;
  try { file = await open(join(directory, 'trace.json'), constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const part = await file.read(buffer, length, buffer.length - length, null);
      if (!part.bytesRead) break;
      length += part.bytesRead;
    }
    if (length > maxBytes) throw new Error('Trace exceeds configured byte limit');
    const records: unknown = JSON.parse(buffer.subarray(0, length).toString('utf8'));
    if (!Array.isArray(records)) throw new Error('Invalid trace');
    return records as DiagnosticRecord[];
  } finally { await file.close(); }
}

/** Called while the writer lock is held. One bounded, atomically replaced ring. */
export async function appendTrace(directory: string, record: DiagnosticRecord, limits: { maxBytes: number; maxRecords: number }) {
  const records = await readTrace(directory, limits.maxBytes);
  records.push(record);
  while (records.length > limits.maxRecords) records.shift();
  while (Buffer.byteLength(JSON.stringify(records)) > limits.maxBytes && records.length > 1) records.shift();
  const raw = JSON.stringify(records);
  if (Buffer.byteLength(raw) > limits.maxBytes) throw new Error('Diagnostic record exceeds trace budget');
  const temp = join(directory, `.trace-${randomUUID()}.tmp`);
  try {
    const file = await open(temp, 'wx', 0o600);
    try { await file.writeFile(raw); await file.sync(); } finally { await file.close(); }
    await rename(temp, join(directory, 'trace.json'));
  } finally { await rm(temp, { force: true }); }
}
