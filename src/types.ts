export interface Snapshot {
  scope: string;
  revision: number;
  markdown: string;
}
export interface Encounter {
  cue: string;
  occurrence: string;
  expectedRevision?: number;
  recentExchange?: ExchangeMessage[];
  correlationId?: string;
  sourceRefs?: string[];
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
  /** Read-only identity; never include credentials or resolve authentication here. */
  describe?(): InferenceBackend;
  infer(input: InferenceInput, signal: AbortSignal, diagnostics?: (metadata: { normalized?: boolean; backend?: InferenceBackend }) => void): Promise<unknown>;
}
export interface InferenceBackend {
  source: string;
  provider?: string;
  model?: string;
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
  diagnosticLoss?: string[];
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
  /** Tokenizer admission includes a separate output reserve when both are set. */
  maxTotalTokens?: number;
  outputTokenReserve?: number;
  /** Project entry point binds this; paths beneath it must remain real directories. */
  directoryRoot?: string;
  diagnostics?: (record: DiagnosticRecord) => void | Promise<void>;
  diagnosticDetails?: boolean;
  trace?: { maxBytes: number; maxRecords: number };
}

/** Ordered host evidence. Absent exchange means unavailable, never an invented history. */
export interface ExchangeMessage {
  role: 'user' | 'assistant' | 'tool';
  text: string;
  sourceRef?: string;
}
export interface DiagnosticRecord {
  operationId: string;
  correlationId?: string;
  scope: string;
  phase: 'prepare' | 'observe' | 'supply';
  timestamp: string;
  durationMs: number;
  beforeRevision?: number;
  afterRevision?: number;
  normalized?: boolean;
  backend?: InferenceBackend;
  outcome: 'committed' | 'failed' | 'supplied';
  failureReason?: string;
  details?: { before?: string; after?: string; suppliedContext?: string };
}
