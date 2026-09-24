import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject, openProjectMemory, decodeInterpretation } from '../dist/index.js';
import type { DiagnosticRecord, ExchangeMessage } from '../dist/index.js';

const projectRoot = await mkdtemp(join(tmpdir(), 'foam-embedded-'));
try {
  await initializeProject(projectRoot);
  const audit: DiagnosticRecord[] = [];
  const memory = await openProjectMemory({ projectRoot, scope: 'private', diagnostics: record => { audit.push(record); },
    inference: { async infer(input, _signal, metadata) {
      // Replace with an in-process model. This scripted response tests plumbing only.
      const raw = '```json\n' + JSON.stringify({ markdown: input.memory.markdown || '# Radiator\nLuma R8: water radiator, width 620 mm, height 910 mm, pipe centres 540 mm.',
        context: 'The note refers to the Luma R8 water radiator and its supplied dimensions. No note update has executed.' }) + '\n```';
      const decoded = decodeInterpretation(raw);
      metadata?.({ normalized: decoded.normalized });
      return decoded.interpretation;
    } } });
  const recentExchange: ExchangeMessage[] = [{ role: 'user', text: 'Luma R8 is a water radiator, 620 mm wide, 910 mm high, pipe centres 540 mm.', sourceRef: 'message-1' }];
  const encounter = { cue: 'Update the note with that.', occurrence: 'encounter-1', correlationId: 'host-request-1', recentExchange };
  const result = await memory.prepare(encounter);
  console.log(result.context);
  await memory.observe({ ...encounter, access: result.access, suppliedContext: result.context, expectedRevision: result.revision,
    observations: ['The client received the context. A note-update tool has not executed.'] });
  console.log(audit.map(record => `${record.phase}: ${record.outcome}`).join('\n'));
} finally { await rm(projectRoot, { recursive: true, force: true }); }
