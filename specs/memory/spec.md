# Contextual awareness through partial recollection

## Purpose and intended behavior

FOAM explores fleeting, partial memory that adds contextual awareness to an agent.
The [vision](../../VISION.md) defines the purpose and anchor examples. An encounter
can leave an impression that a later encounter evokes. Useful recall may be a detail,
a file association or a tentative subject that enables a focused clarification.
Complete reconstruction of activity or task state is not the product objective.

These are intended behaviors, not guarantees of the present interpreter:

- **Epic after a session reset:** earlier work involved files whose relevance is not
  evident in the new task context. In a fresh session using the same authorized scope,
  a recalled connection can supply information, direct the agent toward relevant files,
  or help it ask about the missing material. Full file contents and a complete epic
  summary are not required for the recollection to be useful.
- **Conversation across channels:** after discussing pool opening hours on Discord,
  the same person's “What were the times again?” on WhatsApp may evoke swimming-pool
  hours as a possible subject. “Do you mean the swimming-pool opening hours?” is a
  useful outcome. The host handles the person's confirmation and any lookup needed
  if the hours themselves are not recalled.
- **Read as encounter:** recalling something may change the stored impression or its
  associations. Judge its contribution to awareness, not whether the text changed.
- **Partial and uncertain recall:** a plausible association may be presented tentatively.
  Recollection must not manufacture evidence, certainty, authorization or a completed
  action. A focused question can help; a context-free request to repeat everything
  does not demonstrate useful recollection.

Both examples require host-supplied experience and an explicitly authorized shared
scope. No automatic file discovery, cross-service identity resolution or chat transport
is promised. How impressions form, fade or return is still open; no forgetting schedule,
retention guarantee or required output schema is specified.

## Blueprint — implemented mechanics

Markdown is the persisted memory representation. Its scope/revision envelope and
atomic storage are engineering mechanisms; persistence does not imply exhaustive or
permanent recall. Biological research motivates hypotheses, not a validated cognitive model.

`src/core.ts` exposes `prepare`, `observe`, `inspect`. `src/types.ts` defines the
portable contract. Each instance is explicitly bound to one directory and scope.
`memory.md` is authoritative for stored state, not factual truth, with JSON-quoted
scope and integer revision frontmatter.
`src/inference.ts` supplies a replaceable prompt and an HTTP JSON inference adapter.

Each prepare/observe contains a cue, occurrence and optional expected revision.
Observe can link an access reference, supplied context, observations and source refs.
Prepare returns context, new revision, unique access ID and metrics. The caller must
report supply; prepare alone does not prove attention or successful model delivery.
At most one inference call per operation. A failure throws without replacing memory.
Inspection does not infer or represent a cognitive encounter.

Defaults: 20,480 bytes complete serialized analysis request (including prompt),
12,288 bytes stored Markdown, 2,048 bytes returned context, 30-second timeout.
These are experimental engineering limits. Reject oversize inputs/outputs instead
of silently truncating the supplied input or proposed output. The interpreter can
propose a partial, compacted representation within those bounds. Token limits are
separate: optional caller tokenizer and max-input-token bound, plus an explicit
provider output-token limit.

Single-writer lock spans read/inference/commit. Contenders fail explicitly. Revision
plus content hash detects edits during inference. Atomic rename prevents partial
writes. A retained crash lock fails closed. Scratchpads require a trusted local
filesystem; manual editors must respect the lock. Symlink memory/lock paths are rejected.
Pi prepares at each context event, replacing its prior injected block; turn results
are observations. LangGraph exposes explicit prepare/observe nodes; the caller owns
checkpoint policy. Replaying historical state with a mismatched revision fails.

## Contract — integrity and integration

- Empty scope initializes without cross-scope discovery; a differently labelled file fails.
- Repeated access has unique occurrence metadata and may evolve memory.
- Identical normalized experiences through both adapters have identical policy inputs.
- Restart reads committed Markdown. Inspection leaves its revision unchanged.
- Invalid JSON/schema, oversize input/output, timeout, inference failure, stale revision,
  malformed storage and concurrent writers preserve prior bytes.
- Package contents exclude credentials, scratchpads and copied personal study notes.

Deterministic tests establish these mechanics. Semantic evaluation must separately
ask whether recollection adds useful awareness beyond the current session context.
Credit a relevant association or focused clarification without requiring a full answer
or complete summary. Record missed opportunities, misleading associations, unsupported
certainty, repeated-access effects and cost. Generic requests for context and arbitrary
guesses are not evidence of benefit. A past cue does not establish a new obligation.
The scope of any claim must match the examples and trials actually run.

## 0.2 project and encounter contract

Project mode reads only `<projectRoot>/foam.config.json`, schema version 1, policy
version `0.2`. No parent discovery or environment override occurs. `memoryRoot` and
scope directories are relative child paths. Scope names are declared host bindings;
an optional `scope` label preserves an existing application scope during migration.
Aliases, nested scope directories, traversal and symlink components are rejected.
Paths are rechecked on access, but trusted local filesystem ownership is still required;
this is not protection against a hostile concurrent filesystem owner.

`initializeProject` exclusively creates missing configuration and appends the runtime
root ignore rule without replacing existing settings. `openProjectMemory` accepts an
in-process adapter, otherwise a configured HTTP backend. Credentials are referenced
only by environment-variable name. Constructor configuration stays authoritative.
Pi clears previous bindings before opening a session project, disables memory if opening fails, and uses the session project root and explicitly selected `FOAM_SCOPE`; environment
configuration is available only through `FOAM_MODE=legacy`. CLI init/status/inspect/
recover/migrate share the project binding. Inspection needs neither credentials nor
an inference adapter. Migration locks source and target, validates scope/revision,
copies the complete snapshot, verifies it, and leaves source state unchanged. Existing
`.foam/private` state can be bound in place.

Encounters optionally include `correlationId` (256 characters), `sourceRefs` (64
references of at most 1024 characters), and ordered `recentExchange` (at most 32
messages and 8192 serialized UTF-8 bytes). Roles are user/assistant/tool with text
and an optional sourceRef. Missing exchange is missing evidence. Pi selects the last
eight visible exchanges and adds assistant/tool outcomes for observation. LangGraph
and embedded hosts explicitly supply equivalent normalized evidence. These records
are not a task queue or authorization to execute tools.

The shared `interpretationSchema`, `validateInterpretation` and `decodeInterpretation`
are public. The decoder accepts plain JSON or a single complete newline-delimited
Markdown fence with an empty or `json` label, plus surrounding whitespace. It bounds
raw input (256 KiB default), normalizes only the envelope and reports `normalized`.
Wrong fields/types, commentary, multiple fences, truncation and malformed JSON fail.
The HTTP adapter requires a complete provider response. Core schema, scope, byte,
revision and content-hash checks remain authoritative for every adapter.

The current experimental policy asks for entity identity and fact associations, explicit corrections,
reference resolution from recent evidence, and clarification on ambiguity.
It distinguishes partial completion and negation and never treats requested actions
as completed tools. These are policy objectives, not model reliability guarantees.

Optional tokenizer admission can include `maxTotalTokens` and `outputTokenReserve`;
both require `countTokens`. The complete serialized request plus reserve must fit.
A host tokenizer must account for its provider framing. Provider output limits remain
separate. No cloud or alternate-model fallback occurs on failure.

## 0.2 diagnostics and recovery

The optional diagnostics sink receives operation ID (also the returned access ID),
client correlation, scope, phase, revisions, timestamp, duration, normalization when
reported, failure reason and outcome. Observation records adapter-reported supply as
a separate event referencing the prepared access. Supply is not proof of attention.
Before/after Markdown and supplied context appear only with `diagnosticDetails` enabled.
A successful prepare remains committed if observation fails. No encounter transaction
or automatic replay/deduplication is introduced.

Opt-in local traces are a bounded atomic JSON ring (`trace.json`) under the scope,
with explicit `maxBytes` and `maxRecords`, capped at 16 MiB and 10,000 records.
Oldest records rotate first; an oversized record is rejected and loss reported.
Inspection exposes the coordination gate and retains the current snapshot if trace history is corrupt, reporting diagnostic loss. Trace writes occur under the writer lock. Busy/invalid operations may reach the host
sink but cannot append locally; loss is explicit. Diagnostic sink exceptions and a
one-second sink timeout never invalidate a commit. A result's `diagnosticLoss` exposes
loss/cleanup errors; failed operations include loss in their error. Pi notifies and
LangGraph returns `foamDiagnosticLoss`. Inspection never feeds traces into inference.

Writers create `.writer.lock/owner.json` with operation UUID, PID, hostname, and a
process-incarnation token (start timestamp plus random UUID). A short-lived exclusive
`.coordination.lock` serializes writer acquisition, release and recovery. Writer release
briefly waits for this gate; ordinary contention fails fast. No automatic lock stealing.
Recovery removes a lock only under the gate when its local owner PID is demonstrably
absent (ESRCH). Any live PID, including reuse, is conservatively retained. Unknown,
foreign or legacy empty ownership needs offline operator verification. A crashed
coordination gate also needs offline repair after all clients are stopped; recursively
recovering the gate would reintroduce check/delete races. No age-based liveness rule.

Recovery reports the interrupted operation ID and an unknown commit outcome; inspect
revision/content before deciding what to do. Subprocess termination at inference,
before rename, after rename and before delivery must leave complete old/new memory.
Recovery neither changes that snapshot nor repeats the encounter. Kernel/power-loss
durability and network/distributed locking remain outside the contract.


## Partial-recollection evaluation

The active [partial-recollection-v1 protocol](../../docs/evaluations/partial-recollection-v1.md)
uses the vision's epic/session-reset and pool-hours/channel-switch examples, plus an
ambiguous pool-or-film cue. Fixtures begin with empty memory and expose only chronological
experience. At reset, the runner reopens the persisted scope with a fresh FOAM instance
and clears the recent transcript for interpreter and client. Rolling-summary memory
survives the same reset; the recent-only client receives no pre-reset context.

Useful recalled details, associations and focused clarification are alternative forms
of contribution, not ranked recall tiers. Review the stored impression descriptively,
evoked contribution as useful/no useful contribution/misleading/mixed/unavailable,
and client uptake separately. Missing exact paths or hours is not by itself a failure.
No required wording, exhaustive inventory or aggregate release threshold is established.

Repeated probes receive preceding committed memory without fabricated client outcomes
or confirmation. Scope and occurrence identifiers are neutral so scenario names cannot
hint at the answer. Reviewer expectations never enter inference. All scenarios use an
explicit host-authorized scope, not inferred identity or channel authorization. Real
chat transport, file execution and conditional confirmation are outside these probes.

The interpreter policy is unchanged by this eval redesign. It still asks for an account
of activity, reasons and progress; results must distinguish that implementation from the
product's purpose. The suite evaluates a simulated memory contribution, not end-to-end
reliability of deployed integrations or a prescribed mechanism for fading.

## Historical experiments

The earlier [activity-memory-v1](../../docs/evaluations/activity-memory-v1.md) runner is
available through `npm run eval:activity`; the radiator runner through
`npm run eval:semantic:legacy`. Their before/after reports and original judgements
remain intact. Do not silently rescore them under the current purpose. The unpromoted
causal-policy candidate and its comparison reports also remain available.
