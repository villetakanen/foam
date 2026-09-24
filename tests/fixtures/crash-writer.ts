import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const [directory, stage] = process.argv.slice(2);
if (!directory || !stage) throw new Error('Missing child arguments');
const pause = async (name: string) => {
  process.send?.(name);
  await new Promise(() => { setInterval(() => {}, 1000); });
};
const originalRename = fs.rename;
fs.rename = async (from, to) => {
  if (String(to).endsWith('/memory.md') && stage === 'before-rename') await pause(stage);
  await originalRename(from, to);
  if (String(to).endsWith('/memory.md') && stage === 'after-rename') await pause(stage);
};
syncBuiltinESMExports();
const { Foam } = await import('../../src/index.js');
const foam = new Foam({ directory, scope: 'private', diagnostics: async record => {
  if (stage === 'before-delivery' && record.outcome === 'committed') await pause(stage);
}, inference: { async infer() {
  if (stage === 'inference') await pause(stage);
  return { markdown: 'New complete snapshot.', context: '' };
} } });
await foam.prepare({ cue: 'change', occurrence: 'child' });
process.send?.('completed');
