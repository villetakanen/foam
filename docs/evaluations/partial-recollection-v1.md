# Partial recollection — v1

This evaluation asks whether FOAM adds useful contextual awareness, following the
[vision](../../VISION.md). A grounded association or focused clarification is a useful
outcome in its own right. Complete answers, exact paths and task-state summaries are
not required. These are engineering probes inspired by the vision, not cognitive tests.

First run: [review and evidence](2026-09-24-recollection-review.md).

## Experiences and probes

| Experience | Fresh-session cue | Useful contribution could be |
| --- | --- | --- |
| Work on an epic twice involves otherwise unobvious bridge notes and partner examples. | Continue the epic: what should we look at first? | A reference, its purpose, or a focused question about the supporting material. |
| Discuss pool hours, then another topic; move to a simulated new channel. | What were the times again? | “Do you mean the pool hours?” Exact hours are optional. |
| Discuss pool and film times, then another topic; start a fresh session. | What were the times again? | A tentative subject, a question distinguishing the possibilities, or correctly labelled times. |

The first two include another read without new external evidence. Assess what changes
in accessibility, associations or content and whether it helps; neither mutation nor
immutability is required. A repeated question is not a confirmation.

All experience is fictional. Each scenario starts with empty memory. Before the first
probe, reopen the same persisted FOAM scope and clear all recent conversation messages
for the interpreter and responding client. Subsequent reads see the preceding read's
committed memory. Reviewer expectations, scenario titles and descriptive identifiers
never enter model input; scope and occurrence identifiers are neutral.

This simulates session/channel context loss. It does not exercise real Discord,
WhatsApp, account matching or file tools. The host explicitly authorizes the scope;
FOAM does not infer who may share memory. Client replies are isolated hypothetical
branches, never observed as events. No conditional “yes” turn is fabricated: confirmation
and subsequent tool use remain outside this first probe set.

## Review contribution, not completeness

Review the stored impression, evoked context and client continuation separately:

- **Stored impression:** identify available associations and how they change. Missing
  details alone are not failure; do not demand an inventory of all earlier facts.
- **Evoked contribution:** mark **useful**, **no useful contribution**, **misleading**,
  **mixed**, or **unavailable**, with evidence. A focused clarification has equal status
  to direct recall when it serves the encounter. “Mixed” records both benefit and harm.
- **Client uptake:** did it use the recollection to recognize, consult or ask something
  relevant? Record grounded uncertainty and invented certainty separately. Client failure
  does not retroactively make a useful memory association a storage failure.

Describe the form of contribution (detail, association, clarification) without ranking
them as levels. Exact wording and complete recall are not goals. A generic request to
repeat all context shows no memory benefit; an arbitrary guess is not recollection.
Label agent-authored reviews and leave missing reviews unscored. No aggregate pass
percentage or release threshold is set by these examples.

## Comparison and execution

Compare FOAM, a rolling summary and recent-only, with the same client model and cue.
Recent-only has no old messages after reset. The summary survives reset just as FOAM
memory does; both have 2048-byte state/context caps. FOAM additionally prepares a view
per read. This difference in inference cost must remain visible. Plain-text clients
use the same instruction across conditions; only FOAM interpretations require JSON.

```sh
npm run build
FOAM_MODEL=gemma4:e4b npm run eval:semantic
```

Requires the installed local model and running Ollama; no downloads or fallback.
`FOAM_SCENARIO=epic-reset|channel-switch|competing-cues` selects one. `FOAM_CLIENT_MODEL`,
`FOAM_TRIALS` and `FOAM_REPORT` work as before; the default report is
`.foam/recollection-evaluation.json`. Temperature 0 and seeds starting at 42 are retained
for this initial diagnostic run, not prescribed as FOAM deployment settings. Prompt and
fixture hashes, full traces, state changes, costs and errors are recorded. Repetition at
these settings is not evidence of population reliability.

The current interpreter policy is unchanged, so this can expose its mismatch with the
vision. The previous five-activity harness is available as `npm run eval:activity`, and
the radiator harness as `npm run eval:semantic:legacy`. Historical reports and ratings
are not reinterpreted. These visible synthetic examples do not establish real-world
reliability, forgetting behavior or superiority over a rolling summary.
