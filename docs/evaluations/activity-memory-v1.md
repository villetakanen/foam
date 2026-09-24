# Activity memory evaluations — v1

Current protocol: [partial-recollection-v1](partial-recollection-v1.md). This suite is
retained as `npm run eval:activity`; its shared runner now uses neutral scope/occurrence
identifiers. Historical reports record the identifiers used at the time.

> **Purpose clarification, 2026-09-24:** This protocol predates the clarified
> [vision](../../VISION.md). Its activity-reconstruction rubric needs review to credit
> useful partial recollection, associations and focused clarification. The harness and
> reports remain diagnostic evidence; their judgements are not current product gates.
> The epic/session-reset and pool-hours/channel-switch examples have not yet been
> validated by this suite. The dated account below is preserved as experiment history.

Agreed direction: 2026-09-24. These three evaluations replace the synthetic radiator
release gate. They test whether FOAM maintains a usable, evolving understanding of
ongoing work. They are engineering hypotheses informed by the project's research
reading, not biological benchmarks or a validated population sample.

First completed run: [results and qualitative review](2026-09-24-activity-review.md)
(three activities, six checkpoints, local `gemma4:e4b`).

Follow-up: [matched policy comparison with successive reads](2026-09-24-read-sequence-review.md)
(four workshop checkpoints; clearer current account but lost decision rationale).

Latest: [causal-memory candidate comparison](2026-09-24-causal-review.md)
(five activities, twelve checkpoints; targeted improvement with resumption regressions,
so the preceding policy remains the default).

## Three continuous activities

1. **Following unfolding work:** a volunteer workshop develops from a broad practical
   goal through venue constraints and facility findings to organising participant pairs.
   Does memory express the present situation, the reasons for decisions and the actual
   uncertainty? Can a reader understand where the work has reached?
2. **Returning after interruption:** browser export work is interrupted by a staging
   outage. Later, both activities are revisited. Does context restore the appropriate
   situation, including work already tried and what remains uncertain, without merging
   unrelated results or deleting the activity outside current focus?
3. **Revising understanding:** an apparent parser issue turns out to be malformed input
   silently skipped. Work moves to validation and then reviewing an error message.
   Does memory replace the disproved explanation, retain why the approach changed,
   and express the current work without resurrecting obsolete work or declaring an
   unapproved proposal complete?

The public fictional transcripts and reviewer expectations are in
[activity-fixtures.ts](../../examples/activity-fixtures.ts). Resumption and revision
each have two checkpoints. Unfolding work has four: the original two plus successive
reads about the offline rationale and returning to pairing, added after the first run.
Two further activities probe causal memory: an exhibit delivery date chosen to allow
panels to rest before installation, and a listening-event room whose selection reason
is explicitly unavailable. Each has two reads, including a return of attention or a
repeated question. The current suite therefore has five activities and twelve read
checkpoints addressing the same three evaluation questions. These additions were
written before observing their model outputs; once run, they are development examples,
not a permanently held-out test set.
These are visible development fixtures, not held-out trials. No personal study-note
text or real application transcripts are copied into them.

## Replay and comparison

Start each scenario and trial with empty Markdown and an empty rolling summary.
Observe each completed exchange in order, retaining user/assistant/tool distinctions.
Never seed a desired summary or completion state. Neither memory system receives
future turns, checkpoint expectations or reviewer conclusions.

Compare **FOAM**, a **plain rolling summary**, and **recent exchange only** at each
checkpoint. FOAM and the rolling baseline use the same memory model, chronological
experience, and 2048-byte stored-state and supplied-context caps. The rolling baseline
updates its prose after every exchange, then supplies that prose directly. FOAM also
prepares a cue-specific view at each checkpoint; this may change its memory. The extra
calls and access effects are reported, not assumed free or required to be invariant.
Successive reads see the preceding read's committed memory, with the same recent
transcript messages and no intervening observed outcome. The rolling summary remains
unchanged between these reads. Review whether shifts of attention yield useful,
grounded reconstruction; neither changed nor unchanged Markdown alone is success.
Oversized/failed updates preserve previous state and remain visible as failures.

Every responding-client condition is a fresh, stateless, ordinary text completion
with the same client model, current cue and latest two transcript messages. No forced
memory-shaped JSON response, unrelated host task or task ledger is supplied. A separate
client model may be configured. Client failures do not determine memory quality.
Recent exchange alone may suffice at some checkpoints; this is a legitimate baseline
result, not a reason to hide the comparison or artificially remove more context.

Continuation replies are separate hypothetical branches. They never become the next
scripted event, and no external actions execute. The replay does not claim that its
recorded actor consumed generated memory. This evaluates a memory component using
naturalistic recorded experience; it is not a closed-loop autonomous-agent benchmark.

## Review

Review three surfaces independently, using only the transcript prefix available at
that checkpoint. Expected interpretations are propositions, not required wording.

| Surface | Review question |
| --- | --- |
| Stored memory | Does it capture the current activity, key relationships/reasons, observed progress and uncertainty? |
| Returned context | Does it make the appropriate situation available for this encounter without distortion or distracting unrelated material? |
| Client continuation | Can the reply continue from the actual situation without redundant investigation, invented outcomes or irrelevant assumptions? |

For each surface record **usable**, **partly usable**, **unusable**, or **unavailable**,
with concrete omissions, distortions and supporting evidence. Baseline and FOAM reviews
use the same criteria. Shorter wording, consolidation and selective omission are fine
when the situation remains understandable. A summary is not expected to list every
historical fact or prescribe the only valid next action. A client format/transport
failure is distinct from a mistaken memory representation.

Report counts of reviewed checkpoints and protocol failures, observed changes through
the transcript, input/output sizes, token counts when available and phase latency.
Do not manufacture an aggregate pass percentage or a numerical release threshold.
Initial samples establish inspectable examples of usability; they do not establish
reliability or superiority. Agent-authored reviews must be labelled as such; missing
reviews remain unscored. New held-out sessions are needed before generalizing or
claiming benefits from tuning against these visible examples.

## Running

```sh
npm run build
FOAM_MODEL=gemma4:e4b npm run eval:activity
```

Start local Ollama separately. The runner requires installed local models and never
downloads or falls back. `FOAM_CLIENT_MODEL` defaults to `FOAM_MODEL`; configure it to
separate client capability. `FOAM_SCENARIO` selects `unfolding`, `resumption`, `revision`,
`dispatch-reason` or `unknown-reason`; omission runs all five.
`FOAM_TRIALS` defaults to one (up to ten); `FOAM_REPORT` defaults to
`.foam/activity-evaluation.json`. Reports retain model digests, prompts, fixture/policy
hashes, settings, full request/response traces, snapshots, condition contexts and errors.
Model/runtime settings are recorded, not inferred from a model's answer. Temperature
zero repeats are reproducibility probes, not independent statistical trials.

The old harness is preserved as `npm run eval:semantic:legacy`. Its reports retain
historical observations, but its release verdict and 18/20 target are superseded.
See the [historical rubric](../releases/0.2.0-rubric.md). Runtime APIs are unchanged.
The initial evaluation redesign left policy unchanged; a subsequent policy revision
asks both reads and observations to synthesize the current understanding. Matched
before/after reports retain both prompts and the same extended fixture. Following the project's
[living-spec practice](https://asdlc.io/practices/living-specs/), this methodological
change is recorded alongside the implementation rather than silently reinterpreting
old scores.
