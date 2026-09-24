# First partial-recollection run — 2026-09-24

The new probes show useful contextual awareness after conversation context is removed.
They also distinguish useful partial memory from poor use of it by the responding agent.
This is one diagnostic run, not a reliability estimate.

Release decision, recorded after review: the project owner accepts this level of
useful recollection as sufficient for experimental 0.2. The limitations below remain
unchanged; they are not semantic release blockers.

[Protocol](partial-recollection-v1.md) · [Full trace](2026-09-24-recollection.json)

## Conditions

Three fictional scenarios, seven observed exchanges, five read probes and fifteen
client replies. Local `gemma4:e4b`, unchanged interpreter policy, temperature 0, seed
42, thinking disabled. Equal 2048-byte state/context caps. All 34 calls completed with
zero protocol failures. Model digest, prompts, sizes and latency are in the trace.

Each first probe reopened persisted FOAM memory in a fresh instance and cleared the
recent transcript for both interpreter and client. All five probes had an empty
recent exchange. Rolling summaries survived the same reset; recent-only had no memory.
The descriptive fixture IDs were not supplied through scope or occurrence metadata.

## Agent-authored review

Stored impressions retained the relevant file/partner-format or pool/film associations.
No read changed stored Markdown. That is an observation, not a success or failure.
Storage also contains speculative next-step suggestions in the pool case; they were
not needed for recognition and should not be treated as user commitments.

| Probe | Evoked contribution | Client uptake |
| --- | --- | --- |
| Continue epic after reset | **Useful:** links partner-field aliases to the two supporting files. | Uses both references and asks which export option is next. This contributes awareness beyond the fresh task description. |
| Ask about supporting material | **Useful, limited:** recalls Atlas and field aliases, but does not return the stored file references. The topic association still adds context to an otherwise vague cue. | Retains the subject in its clarification, but says it has no record of providing supporting material. This is weak uptake: it could use the association to ask about partner-format references. Do not confuse missing context in this reply with proof that the earlier material never existed. |
| Ask for times in new channel context | **Useful:** recalls pool hours with correct values and labels. | Answers the pool-hours question. A focused “Do you mean the pool hours?” would also have counted; exact values are not required by the rubric. |
| Repeat the times cue | **Useful:** same grounded recall, with no invented confirmation. | Same answer. This deterministic repeat does not establish stability in broader use or a need for unchanged memory. |
| Pool-or-film ambiguity | **Useful:** evokes both possible subjects without the times. That partial association is sufficient to support clarification. | **Mixed:** recognizes pool and film and admits missing times, but calls them “scheduled” activities although the user had not chosen. The problem is unsupported status, not failure to return both schedules. |

The rolling-summary condition supplies the supporting references and correctly labelled
times in all these probes. Recent-only asks for context and cannot identify the earlier
references or subjects. Thus the run shows a contribution from persisted context in
these examples, but no advantage of FOAM over rolling summary.

## What remains untested

These short transcripts do not test long-term interference or fading. The session reset
is a context boundary and object reopen, not a separate-process or live chat deployment.
No real file reads, Discord/WhatsApp transport, user confirmation branch or later tool
execution occurs. No successful client confirmation question was observed in this run;
the rubric permits that outcome, but its usefulness is not empirically demonstrated by
the model merely being allowed to ask one. The ambiguous probe does demonstrate that a
partial evoked association can carry useful information even when the client mishandles it.

The fixtures are public development examples. Further evaluation should vary their
surface details and competing cues before making general claims. No policy tuning or
automatic score threshold was introduced in response to this run.

Mechanical validation: 41 tests pass, including reset/context isolation and metadata
leak prevention; both synthetic demos pass. These checks are separate from the review above.
