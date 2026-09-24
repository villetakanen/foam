# First activity-memory evaluation — 2026-09-24

The new evaluations expose useful, distinct failures. In this run FOAM sometimes
retained the needed experience but failed to return it, and sometimes failed to
maintain a meaningful summary at all. The rolling summary was more useful across
these examples, but also lost an interrupted activity. This is diagnostic evidence
from one model and three visible fixtures, not a general ranking or release verdict.

[Protocol](activity-memory-v1.md) ·
[Complete requests, responses and memory snapshots](2026-09-24-gemma-e4b-activity.json)

## Run

- Local `gemma4:e4b` for memory, rolling summary and responding client; Ollama 0.34.0,
  Apple M4 Max. Model digest and full settings are in the raw report.
- One trial per activity, temperature 0, seed 42, thinking disabled.
- Empty initial memory; 14 completed exchanges, six checkpoints, 18 client replies.
- Equal 2048-byte stored-memory and supplied-context caps; latest two transcript
  messages available to every client condition.
- Zero protocol failures across 52 calls. Successful transport and valid output
  envelopes do not mean the memory was useful.
- All six checkpoints ran clients in FOAM, rolling-summary, recent-only order. The
  runner uses turn parity, which does not counterbalance these fixtures. Latencies
  are descriptive, not a controlled speed comparison.

## Review of stored memory and returned context

These are **agent-authored qualitative reviews**, not independent human judgements.
Each row uses only the transcript prefix available at that checkpoint. Stored-memory
ratings assess the whole current situation, including suspended work. Returned-context
ratings assess the focused view together with the recent exchange the client receives.
FOAM's Markdown did not change during any of the six checkpoint accesses.

| Checkpoint | FOAM stored memory | FOAM returned context | Rolling summary (stored and supplied directly) |
| --- | --- | --- | --- |
| Workshop: venue options | **Partly usable.** Retains a generic plan to compare venues and choose an exercise, but misses the beginner audience, headcount and new venue constraints. | **Partly usable.** Returns venue facts and a conditional Tide recommendation, but loses the practical purpose and audience. Mostly repeats recent messages. | **Usable.** Preserves purpose, twelve beginners, budget/access constraints and the next activity decision without claiming a booking. |
| Workshop: current plan | **Partly usable.** Has offline rationale and uncertain attendance, but retains the old venue-comparison plan and does not clearly identify Tide as the settled choice. | **Partly usable.** Identifies pairing and unknown attendance, but adds no earlier rationale beyond the recent exchange. | **Usable.** Connects the chosen Tide venue, unreliable internet, offline activity and pairing focus. |
| Return to export | **Usable.** Retains browser-side bottleneck, unchanged columns, completed Chromium comparison and outstanding Safari check alongside resolved staging work. | **Unusable.** Only says the user wants to resume export work. The actual stopping point in stored memory is absent. | **Unusable.** Staging dominates; calls implementation a paused plan despite the applied patch and loses the Chromium result and outstanding Safari check. |
| Return to staging | **Partly usable.** Staging repair is retained, but export still says Safari is untested after it passed; review/not-deployed state is missing. | **Usable.** Retrieves staging proxy 8081 and passed smoke tests without importing export checks. It could state recovery and the original mismatch more clearly. | **Usable.** Retains resolved staging routing separately from export tests and review/not-deployed state. |
| Changed import diagnosis | **Unusable.** Markdown contains only `evaluation:revision` and whitespace. No working understanding is retained. | **Usable.** States that quoted-comma hypothesis is unsupported and malformed input is silently skipped; recent tool evidence supplies the unmatched quote. | **Usable.** Preserves the hypothesis, discriminating test, observed malformed row and revised diagnosis. |
| Current import understanding | **Unusable.** Still only the scope label. Implementation progress and rationale are absent. | **Partly usable.** Correctly identifies wording review and the draft, but omits completed validation and why valid-file parsing was preserved. | **Usable.** Captures implemented validation, passing valid-file checks and wording awaiting review. Parser-preservation rationale is implicit rather than explicit. |

## Review of client continuations

These ratings describe the observed replies, not a causal estimate of memory benefit.
A good reply supported by the recent exchange alone does not demonstrate memory.

| Checkpoint | FOAM client | Rolling-summary client | Recent-only client |
| --- | --- | --- | --- |
| Venue options | **Partly usable:** accurately recaps venue criteria but lacks the broader workshop purpose and asks generally what to discuss. | **Usable:** identifies Tide as a candidate and selecting the practical activity as next. | **Partly usable:** accurate venue recap, then asks which part of the plan is meant. |
| Current plan | **Usable:** proposes flexible pairing while attendance is unknown. | **Usable:** suggests several possible pairing arrangements as proposals. | **Partly usable:** offers pairing but also reopens the choice of focus already stated by the user. |
| Return to export | **Unusable:** asks the user to remind it where work stopped. | **Unusable:** also asks where export work stopped. | **Unusable:** cannot identify the stopping point and asks where to resume. |
| Return to staging | **Partly usable:** recalls proxy repair and passed checks, but first recites unrelated export work and invents the order in which staging was discussed. | **Usable:** directly reports resolved staging routing and verification. | **Unusable:** requests staging context it lacks. |
| Changed diagnosis | **Usable:** explains the move from suspected comma handling to malformed-input reporting without claiming a fix. | **Usable:** follows the changed diagnosis and proposes next work. Its claim that further valid-comma testing would be unproductive is too broad; regression coverage remains useful. | **Usable:** recent evidence alone supports the changed direction. |
| Current understanding | **Unusable:** proposes importing again instead of continuing the explicitly pending wording review. | **Usable:** returns to review of the proposed message without claiming approval. | **Partly usable:** stays near error messaging but asks for a focus already supplied in the recent exchange. |

## Cost observed

| Phase | Calls | Total elapsed call time | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: |
| FOAM observe + prepare | 20 | 54.97 s | 13,377 | 3,129 |
| Rolling-summary updates | 14 | 21.05 s | 3,854 | 1,246 |
| Client continuations, all conditions | 18 | 28.23 s | 3,509 | 1,780 |

These include provider/cache/loading effects and are not normalized performance
estimates. Per-call sizes, tokens and latency are retained in the report. FOAM gets
six additional focus calls; the baseline supplies its existing summary directly.

## What this establishes

The three activities now test the intended questions through ordinary experience:
forming a current understanding, recovering interrupted work, and changing that
understanding as evidence and goals develop. The interruption checkpoint is especially
informative because its recent exchange concerns another activity.

The next implementation investigation should distinguish **failure to update stored
memory** from **failure to evoke information already stored**. Export resumption is a
clear example of the second; the import scope-only state is a clear example of the
first. The final import reply also shows a client can ignore a useful focused cue.
No policy or runtime behavior was tuned to these results in this change.

This run cannot establish reliability, a model-wide comparison, or readiness for
release. The fixtures are short, public and scripted; several probes can be answered
from recent context alone. Any future tuning needs new held-out activities, including
delayed revisits after intervening work, to test whether improvement generalizes.
