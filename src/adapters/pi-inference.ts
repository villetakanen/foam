import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { decodeInterpretation } from '../response.js';
import type { InferenceAdapter } from '../types.js';

/** Uses Pi's provider registry, including request-time auth; never starts an agent turn. */
export function piInference(resolve: () => Pick<ExtensionContext, 'model' | 'modelRegistry'>,
  options: { maxOutputTokens?: number } = {}): InferenceAdapter {
  const maxTokens = options.maxOutputTokens ?? 4096;
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) throw new Error('Invalid output token limit');
  return {
    describe() {
      const { model } = resolve();
      return { source: 'pi', ...(model ? { provider: model.provider, model: model.id } : {}) };
    },
    async infer(input, signal, diagnostics) {
      signal.throwIfAborted();
      const { model, modelRegistry } = resolve();
      if (!model) throw new Error('No active Pi model; select a model in this session');
      diagnostics?.({ backend: { source: 'pi', provider: model.provider, model: model.id } });
      const { instruction, ...evidence } = input;
      const response = await modelRegistry.streamSimple(model, {
        systemPrompt: instruction,
        messages: [{ role: 'user', content: JSON.stringify(evidence), timestamp: Date.now() }],
      }, { signal, maxTokens, maxRetries: 0 }).result();
      signal.throwIfAborted();
      if (response.stopReason !== 'stop') {
        throw new Error(`Pi memory inference did not complete (${response.stopReason})${response.errorMessage ? `: ${response.errorMessage}` : ''}`);
      }
      if (response.content.some(part => part.type === 'toolCall')) throw new Error('Pi memory inference returned a tool call');
      const text = response.content.filter(part => part.type === 'text').map(part => part.text).join('');
      const decoded = decodeInterpretation(text);
      diagnostics?.({ normalized: decoded.normalized });
      return decoded.interpretation;
    },
  };
}
