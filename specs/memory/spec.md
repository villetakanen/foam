# Evolving working memory

## Blueprint

FOAM holds a small, changing representation of activity. Completed episodes may
return to mind without making their former intentions current again. This is an
engineering hypothesis, not a validated cognitive model.

`src/core.ts` exposes `prepare`, `observe`, `inspect`. `src/types.ts` defines the
portable contract. Each instance is explicitly bound to one directory and scope.
`memory.md` is authoritative, with JSON-quoted scope and integer revision frontmatter.
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
of truncating or silently dropping activities. The interpreter can compact or release
material with evidence. Token limits are separate: optional caller tokenizer and
max-input-token bound, plus an explicit provider output-token limit.

Single-writer lock spans read/inference/commit. Contenders fail explicitly. Revision
plus content hash detects edits during inference. Atomic rename prevents partial
writes. A retained crash lock fails closed. Scratchpads require a trusted local
filesystem; manual editors must respect the lock. Symlink memory/lock paths are rejected.
Pi prepares at each context event, replacing its prior injected block; turn results
are observations. LangGraph exposes explicit prepare/observe nodes; the caller owns
checkpoint policy. Replaying historical state with a mismatched revision fails.

## Contract

- Empty scope initializes without cross-scope discovery; a differently labelled file fails.
- Interrupt repair work with travel planning, then cue the repair: restore its situation.
- Learn the repair is complete, then present an old cue: recall completion, avoid a stale action.
- Completion must not create unsupported verification, monitoring, documentation, urgency,
  or emotional interpretations. An old cue is not evidence of a new obligation.
- Repeated access has unique occurrence metadata and may evolve memory.
- Identical normalized experiences through both adapters have identical policy inputs.
- Restart reads committed Markdown. Inspection leaves its revision unchanged.
- Invalid JSON/schema, oversize input/output, timeout, inference failure, stale revision,
  malformed storage and concurrent writers preserve prior bytes.
- Package contents exclude credentials, scratchpads and copied personal study notes.

Deterministic tests establish mechanics; live repeated trials assess model behaviour.
Record latency, calls, context bytes, unsupported additions and stale actions against
an unchanged compact-note baseline. Neither fixture results nor substring checks alone
establish cognitive validity or superiority.
