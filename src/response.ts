import type { Interpretation } from './types.js';

export const interpretationSchema = {
  type: 'object', properties: { markdown: { type: 'string' }, context: { type: 'string' } },
  required: ['markdown', 'context'], additionalProperties: false,
} as const;

export function validateInterpretation(value: unknown): Interpretation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid interpreter response');
  const object = value as Record<string, unknown>;
  if (Object.keys(object).sort().join(',') !== 'context,markdown' || typeof object.markdown !== 'string' || typeof object.context !== 'string') {
    throw new Error('Invalid interpreter schema');
  }
  return { markdown: object.markdown, context: object.context };
}

/** Normalize only one complete JSON fence. Never extract, repair or truncate content. */
export function decodeInterpretation(raw: string, maxBytes = 262144): { interpretation: Interpretation; normalized: boolean } {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid response byte limit');
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > maxBytes) throw new Error('Interpreter response exceeds byte budget');
  const text = raw.trim();
  const fence = /^```(?:json)?\r?\n([\s\S]*)\r?\n```$/.exec(text);
  const interpretation = validateInterpretation(JSON.parse(fence ? fence[1]! : text));
  return { interpretation, normalized: !!fence };
}
