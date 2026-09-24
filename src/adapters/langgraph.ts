import type { Foam } from '../core.js';
import type { Access, Encounter } from '../types.js';

/** Persist foamRevision and foamAccess in your graph checkpoint. */
export interface MemoryState extends Pick<Encounter, 'recentExchange' | 'correlationId' | 'sourceRefs'> {
  cue: string;
  occurrence: string;
  observations: string[];
  foamRevision?: number;
  foamContext?: string;
  foamAccess?: Access;
  foamDiagnosticLoss?: string[];
}
export function memoryNodes(foam: Foam) {
  const evidence = (state: MemoryState) => ({
    ...(state.recentExchange !== undefined ? { recentExchange: state.recentExchange } : {}),
    ...(state.correlationId !== undefined ? { correlationId: state.correlationId } : {}),
    ...(state.sourceRefs !== undefined ? { sourceRefs: state.sourceRefs } : {}),
  });
  return {
    async prepare(state: MemoryState) {
      const result = await foam.prepare({ cue: state.cue, occurrence: state.occurrence, ...evidence(state),
        ...(state.foamRevision !== undefined ? { expectedRevision: state.foamRevision } : {}) });
      return { foamContext: result.context, foamRevision: result.revision, foamAccess: result.access, foamDiagnosticLoss: result.diagnosticLoss ?? [] };
    },
    /** Call only after the model received foamContext; observations should be actual outcomes. */
    async observe(state: MemoryState) {
      if (!state.foamAccess || state.foamRevision === undefined || state.foamContext === undefined) throw new Error('Prepare before observing model results');
      const result = await foam.observe({ cue: state.cue, occurrence: state.occurrence, ...evidence(state),
        observations: state.observations, access: state.foamAccess,
        suppliedContext: state.foamContext, expectedRevision: state.foamRevision });
      return { foamRevision: result.revision, foamContext: '', foamAccess: undefined, foamDiagnosticLoss: result.diagnosticLoss ?? [] };
    },
  };
}
