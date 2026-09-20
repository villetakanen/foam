import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foam } from '../dist/index.js';
import { fixtureInference, cues } from './fixture.js';

const directory = await mkdtemp(join(tmpdir(), 'foam-demo-'));
try {
  const foam = new Foam({ directory, scope: 'synthetic:alex', inference: fixtureInference });
  console.log('FOAM synthetic mechanics demo — scripted inference, not live-model evidence.');
  for (const [index, cue] of cues.entries()) {
    const result = await foam.prepare({ cue, occurrence: `encounter-${index}` });
    console.log(`\n${cue}\nRevision ${result.revision} · ${result.metrics.contextBytes} context bytes\n${result.context}`);
    await foam.observe({ cue, occurrence: `encounter-${index}`, access: result.access,
      suppliedContext: result.context, observations: ['The demo displayed the context.'] });
  }
  console.log('\nFinal scratchpad:\n' + (await foam.inspect()).markdown);
} finally { await rm(directory, { recursive: true, force: true }); }
