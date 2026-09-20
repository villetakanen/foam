export interface Snapshot {
  scope: string;
  revision: number;
  markdown: string;
}
export interface Encounter {
  cue: string;
  occurrence: string;
  expectedRevision?: number;
}
export interface Access {
  id: string;
  scope: string;
  revision: number;
  occurrence: string;
}
export interface Observation extends Encounter {
  observations: string[];
  access?: Access;
  suppliedContext?: string;
  sourceRefs?: string[];
}
export interface Interpretation {
  /** Complete replacement Markdown. Return the current text for no content change. */
  markdown: string;
  context: string;
}
export interface InferenceInput {
  instruction: string;
  operation: 'prepare' | 'observe';
  memory: Snapshot;
  encounter: Encounter | Observation;
  limits: { memoryBytes: number; contextBytes: number };
}
export interface InferenceAdapter {
  infer(input: InferenceInput, signal: AbortSignal): Promise<unknown>;
}
export interface Metrics {
  inferenceCalls: number;
  latencyMs: number;
  inputBytes: number;
  inputTokens?: number;
  contextBytes: number;
}
export interface Result extends Snapshot {
  context: string;
  access: Access;
  metrics: Metrics;
}
export interface FoamOptions {
  directory: string;
  scope: string;
  inference: InferenceAdapter;
  maxMemoryBytes?: number;
  maxInputBytes?: number;
  maxContextBytes?: number;
  timeoutMs?: number;
  countTokens?: (serializedInput: string) => number;
  maxInputTokens?: number;
}
