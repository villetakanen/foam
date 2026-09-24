# Roadmap

## Purpose clarification — 2026-09-24

FOAM explores fleeting, partial recollection that adds contextual awareness. The
[vision](VISION.md) anchors this in an epic resumed after a session reset and a
conversation continued across channels. A useful file association or a focused
“Do you mean the pool hours?” question can be a success without complete recall.

The next work is to refine those use cases and resolve how impressions form, fade
and are evoked. The [new recollection probes](docs/evaluations/partial-recollection-v1.md) now exercise
the two anchor examples and ambiguity; next assess the interpretation policy against
that purpose. More task-state summary tuning is not the current product direction.
No forgetting algorithm or retention schedule has been agreed.

The [earlier activity evaluations](docs/evaluations/activity-memory-v1.md) and reports remain
inspectable diagnostics. Their completeness-oriented judgements do not serve as
product acceptance gates. Reframing them requires review, not retroactive score changes.

## Implementation status

The project owner accepted the [partial-recollection evidence](docs/evaluations/2026-09-24-recollection-review.md)
as sufficient for experimental 0.2 on 2026-09-24. Semantic evaluation is no longer a
release blocker; the observed limitations are follow-up work. Release version: `v0.2.0` (2026-09-24).

The 0.2 implementation provides project configuration, CLI/migration,
shared decoding, recent exchange evidence, diagnostics and local recovery. Pi,
LangGraph and embedded clients share the core. Storage persistence and adapter checks
do not establish the intended quality of recollection. There are no bundled Discord
or WhatsApp integrations. Further interpretation-policy review against the vision remains follow-up work.

## Historical 0.2 planning

The following goals preserve earlier planning and its status labels. They describe
how the implementation evolved, not a competing current definition of FOAM. Where
semantic targets presume complete activity reconstruction, the vision above takes
precedence. Operational integrity and explicit scope boundaries still apply.

## 0.2.0 goals

The [0.2.0 delivery plan](docs/releases/0.2.0-plan.md) turns these goals into a
planned implementation sequence, scope boundaries and release gates. The statuses
below retain the history of agreed direction and proposals; no implementation is
complete merely because it appears in the plan.

### Assessment after ACK field feedback — 2026-09-23

The [ACK feedback record](docs/feedback/2026-09-23-ack.md) reports successful
in-process integration but unhelpful evoked context. This strengthens the need for
semantic quality checks alongside operational health. The underlying audit has not
been independently reviewed; proposed priorities below are planning judgments.

| Goal | Assessment and proposed priority |
| --- | --- |
| Project-owned memory and configuration | Retain the agreed goal. Support embedded clients such as ACK as well as Pi and LangGraph; no mandatory HTTP service. |
| Entity identity, relevant context and encounter continuity | Highest-priority new quality goal: directly motivated by the reported conversation failure. |
| Structured-output interoperability | High-priority compatibility goal: ACK already needs a JSON-fence workaround. |
| Inspectable memory encounters | Retain the proposal; build on existing host correlation/audit facilities and use them to diagnose semantic failures. |
| Interrupted-run recovery | Retain the proposal based on the observed Pi stale lock. ACK's abandoned operations warrant investigation, not an assumption of the same cause. |
| Memory contribution and repeated-access drift | Treat as proposed release evidence across the goals, including useful continuation rather than only valid output. |

New goals remain proposed; adding them to this plan does not mark them implemented
or establish release thresholds. Durable task execution and confirmation state stay
with the host application.

### Project-owned memory and configuration

Status: planned. Agreed 2026-09-20 after initial Pi usage.

FOAM should be configured for a project, with Pi and LangGraph acting as clients
of that project's memory. The 0.1.0 setup exposes this primarily through Pi launch
commands and shell variables, making memory feel tied to the client.

Acceptance criteria:

- Memory lives under `.foam/` at the project root, rather than `.agents/.foam/`.
  `.agents/` remains a place for agent instructions and skills.
- Project-level configuration defines the memory scopes, shared policy and inference
  backend independently of the client. Its filename and schema remain to be designed.
- Pi and LangGraph can load the same project configuration and access the same
  explicitly authorized scope without duplicating setup in host-specific launch commands.
- Embedded clients such as ACK can supply their inference adapter directly and use
  the same scope/policy configuration without running a FOAM HTTP service. Project
  setup must preserve explicit scope binding for non-project application use.
- A project can contain separate scopes for different audiences or purposes;
  project membership alone does not authorize access to every scope.
- Runtime memory under `.foam/` is ignored by Git by default. Document which
  configuration is safe to share; credentials stay outside version control.
- Document migration from the 0.1.0 environment-variable setup, preserving existing
  memory and scope boundaries. Verify shared configuration and scope isolation across
  both adapters.

### Inspectable memory encounters

Status: proposed. Recorded 2026-09-20 following the Pi field-trial review.

The trial could not establish which context FOAM supplied or how memory changed
across encounters. Existing access IDs, revisions and metrics provide a starting
point; the proposal is to make encounters inspectable across clients.

Proposed acceptance criteria:

- Expose the context supplied by the adapter, scope, revision, encounter/access ID,
  associated observation references, before/after memory changes, duration and outcome.
- Distinguish preparation, adapter-reported supply and observed results; supplying
  context does not prove that the responding model used it.
- Keep diagnostic history bounded, separate from the authoritative Markdown memory,
  and subject to the same scope access restrictions.
- Expose equivalent diagnostics for Pi and LangGraph. Inspection does not itself
  create a memory encounter.
- Allow embedded clients such as ACK to correlate these diagnostics with their
  existing audit. Record operation phase and distinguish failed, cancelled, abandoned
  and committed work; a healthy current snapshot does not erase historical failures.

This proposal does not require a structured task ledger, per-claim confidence scores
or a new retrieval-ranking system; the trial did not establish those requirements.

### Interrupted-run recovery

Status: proposed. Recorded 2026-09-20 after an interrupted Pi run left an empty
writer lock that required manual removal.

Atomic replacement, revision checks and writer exclusion already exist in 0.1.0.
The proposed improvement is safe recovery and clear diagnostics for abandoned locks.

Proposed acceptance criteria:

- Record enough lock-owner information to distinguish an active writer from an
  abandoned lock; elapsed time alone is not proof that recovery is safe.
- Provide an explicit recovery path that preserves committed memory and never
  steals a live writer's lock. If ownership cannot be established safely, explain
  what must be checked rather than automatically removing the lock.
- Verify recovery after process interruption, contention between clients, and
  interruption around the atomic replacement boundary. Memory remains a complete
  committed snapshot, and a subsequent operation can proceed after safe recovery.
- Classify ACK's reported abandoned operations using host correlations before
  assigning a cause. Distinguish host queue cancellation, inference failure, lock
  contention and a commit whose result was not delivered; do not blindly replay an
  operation that may already have changed memory.

### Entity identity, relevant context and encounter continuity

Status: proposed. Added 2026-09-23 from ACK field feedback.

ACK reports that compacting changed a radiator's identity, that older observations
competed with the active purchase in the evoked view, and that a following note-update
request lost its connection to the supplied description. Diagnose stored memory,
evoked context and host continuation separately.

Proposed acceptance criteria:

- In synthetic purchase scenarios, preserve the entity type and the association of
  its dimensions and constraints through updates, compaction and repeated access.
  Do not replace a known radiator with a battery or discard identity needed to
  disambiguate a subsequent request. Test ambiguity and explicit corrections too.
- Evoke facts relevant to the active conversational subject; omit unrelated older
  readings unless the encounter establishes their relevance. Exclusion from `context`
  alone is not evidence for deleting an unrelated activity from the scratchpad.
- Keep a recent request and the facts it references connected, including when host
  message boundaries split the exchange. Test both bundled and sequential observations
  with explicit ordering/correlation; a host turn boundary is not necessarily an
  activity boundary.
- Given a description followed by a request to update a note about it, the client can
  identify the intended subject and supplied facts. FOAM context is neither a durable
  pending-task record nor authorization or proof that the note was updated. The host
  owns tool execution, confirmations, retries and completion state.
- Measure identity substitutions, lost fact associations, irrelevant context,
  unnecessary clarification and invented obligations separately. Include legitimate
  ambiguity cases where clarification is correct. Use controlled repeated live runs
  as well as deterministic adapter checks.

### Structured-output interoperability

Status: proposed. Added 2026-09-23 from ACK's JSON-fence workaround.

The reference HTTP adapter already requests strict JSON-schema output. Preserve core
validation, and make output handling reusable by HTTP and in-process model adapters.

Proposed acceptance criteria:

- Expose the response schema for adapters that support constrained generation and
  document that a provider request alone does not guarantee schema compliance.
- Provide an explicit compatibility decoder accepting plain JSON or one complete
  JSON object enclosed by a single Markdown code fence, with optional whitespace.
  Limit accepted fence labels to empty or `json`, and bound input before parsing.
- Normalize only the envelope. Reject surrounding commentary, multiple blocks,
  truncated or malformed JSON, and schema-invalid objects. Do not repair values,
  extract a convenient substring, or weaken memory/context budgets and scope checks.
- Give plain and fenced equivalents identical validated results. Record normalization
  and rejection outcomes in diagnostics; failures preserve committed memory.
- Verify the shared decoder through the reference backend and a custom in-process
  adapter so each client need not implement its own parsing workaround.

### Supporting experiment: memory contribution and repeated-access drift

Status: proposed evaluation work for 0.2.0.

Replay the same activity with FOAM enabled and disabled, holding project context,
model configuration and scripted experience constant. Include interruption,
resumption, explicit completion, unrelated activity and repeated old cues.

Add a synthetic ACK-like sequence: describe a radiator and its installation constraints,
mix in unrelated older sensor observations, then request a note update referring to
the description. Retain the same host task state in both conditions. Compare what was
stored, what was supplied and what the client did; do not count successful JSON parsing
or a healthy scratchpad as successful conversational continuation.

Record supplied context, memory changes, model responses, latency and failures.
Assess grounded continuation, preservation of unrelated activity and unsupported
or obsolete obligations across repeated trials. Report observations separately
from causal claims; an assistant's attribution of its own answer is not evidence
that memory improved it. Refine the living memory spec with the resulting findings.

The project-ownership goal is agreed; the additional goals and experiment above
remain proposals. This is not the complete 0.2.0 release scope. Implementation is pending.
