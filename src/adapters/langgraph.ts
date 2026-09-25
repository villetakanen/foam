import type { Foam } from '../core.js';
import type { Access, Encounter, InferenceAdapter, InferenceBackend, InferenceInput } from '../types.js';
import { decodeInterpretation } from '../response.js';

export const MEMORY_CALL_TAG = 'foam:memory';
export interface MemoryCallOptions {
  signal: AbortSignal;
  tags: string[];
  metadata: Record<string, unknown>;
  runName: string;
  maxTokens: number;
  configurable?: Record<string, unknown>;
}
export type MemoryMessages = { role: 'system' | 'user'; content: string }[];
/** A structural interface: no LangChain runtime dependency in FOAM. */
export interface MemoryChatModel {
  invoke(messages: MemoryMessages, options: MemoryCallOptions): Promise<unknown>;
}
export type MemoryModelCall = (messages: MemoryMessages, options: MemoryCallOptions) => Promise<unknown>;

/** Pass an existing unbound chat model, or a caller-owned routing function. */
export function langGraphInference(model: MemoryChatModel | MemoryModelCall, options: {
  maxOutputTokens?: number;
  configure?: (input: InferenceInput) => { configurable?: Record<string, unknown>; tags?: string[]; metadata?: Record<string, unknown> };
  describe?: () => Omit<InferenceBackend, 'source'>;
} = {}): InferenceAdapter {
  const maxTokens = options.maxOutputTokens ?? 4096;
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) throw new Error('Invalid output token limit');
  return {
    describe: () => ({ ...options.describe?.(), source: 'langgraph' }),
    async infer(input, signal, diagnostics) {
      signal.throwIfAborted();
      diagnostics?.({ backend: { ...options.describe?.(), source: 'langgraph' } });
      const { instruction, ...evidence } = input;
      const configured = options.configure?.(input);
      const callOptions: MemoryCallOptions = { ...configured, signal,
        tags: [...(configured?.tags ?? []), MEMORY_CALL_TAG, 'langsmith:nostream'],
        metadata: { ...configured?.metadata, foam: true, foamOperation: input.operation }, runName: 'foam.memory', maxTokens };
      const messages: MemoryMessages = [{ role: 'system', content: instruction }, { role: 'user', content: JSON.stringify(evidence) }];
      const output = await (typeof model === 'function' ? model(messages, callOptions) : model.invoke(messages, callOptions));
      signal.throwIfAborted();
      let text: string;
      if (typeof output === 'string') text = output;
      else {
        if (!output || typeof output !== 'object') throw new Error('Memory model returned no text');
        const response = output as { content?: unknown; tool_calls?: unknown[]; invalid_tool_calls?: unknown[];
          additional_kwargs?: { tool_calls?: unknown; function_call?: unknown };
          response_metadata?: { finish_reason?: unknown; stop_reason?: unknown } };
        const extraCalls = response.additional_kwargs?.tool_calls;
        if (response.tool_calls?.length || response.invalid_tool_calls?.length ||
          (Array.isArray(extraCalls) ? extraCalls.length : extraCalls) || response.additional_kwargs?.function_call) {
          throw new Error('Memory model returned a tool call; use a model without bound tools');
        }
        const finish = response.response_metadata?.finish_reason ?? response.response_metadata?.stop_reason;
        if (finish !== undefined && !['stop', 'end_turn', 'stop_sequence'].includes(String(finish))) throw new Error(`Incomplete memory model response (${String(finish)})`);
        if (typeof response.content === 'string') text = response.content;
        else if (Array.isArray(response.content)) {
          text = response.content.map(part => {
            if (part?.type === 'text' && typeof part.text === 'string') return part.text;
            if (['thinking', 'reasoning', 'reasoning_content'].includes(part?.type)) return '';
            throw new Error('Unsupported memory response content block');
          }).join('');
        } else throw new Error('Memory model returned no text');
      }
      const decoded = decodeInterpretation(text);
      diagnostics?.({ normalized: decoded.normalized });
      return decoded.interpretation;
    },
  };
}

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
