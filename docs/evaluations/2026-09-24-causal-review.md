# Decision reasons and missing evidence — 2026-09-24

The candidate fixes the workshop's lost offline rationale and preserves an explicitly
unknown room rationale across repeated reads. It also regresses export resumption and
describes a resolved staging outage as unfinished work. **The candidate is not promoted:**
the preceding interpretation policy is restored as default. The new fixtures remain.

## Evidence and method

- [Preceding-policy report](2026-09-24-causal-before.json)
- [Candidate-policy report](2026-09-24-causal-after.json)
- [Exact candidate prompt](2026-09-24-causal-policy-candidate.txt)
- [Protocol and qualitative rubric](activity-memory-v1.md)

The intervention adds instructions to preserve a decision's specific evidence or
constraint, distinguish it from the activity's broader goal, and leave absent reasons
unknown instead of filling gaps with plausible explanations. No runtime mechanism,
temperature, byte budget, client prompt or baseline prompt changes.

Both runs use the same five fixtures, local `gemma4:e4b` digest, temperature 0, seed 42,
thinking disabled and 2048-byte memory/context caps. Fixture hashes, model metadata,
settings and budgets match. Each run has 20 exchanges, 12 read checkpoints, 36 client
replies and 88 calls, with zero protocol failures. Existing fixture checkpoints use
FOAM/rolling/recent-only order; the two new examples use recent-only/rolling/FOAM order.
Orders match between runs but are not randomized. Each read sees the preceding read's
committed state. Hypothetical client replies never become observed events.

The dispatch and unknown-reason fixtures were written before seeing their outputs.
The candidate was fixed before either run's results were inspected and was not tuned
again within this comparison. These examples are now public development fixtures,
not held-out evidence for future tuning. One run per policy cannot establish reliability.

## Agent-authored review

**U = usable, P = partly usable, X = unusable.** Each triple is **stored memory /
returned context / client continuation**, judged separately against the available
transcript prefix. No aggregate score or release threshold is inferred.

| Checkpoint | Preceding policy | Candidate | Evidence |
| --- | --- | --- | --- |
| Venue options | U / U / U | U / P / U | Candidate retains headcount, cost and access constraints in storage; focused view omits beginner audience/headcount but keeps venue and next activity decision. |
| Current workshop plan | P / P / U | P / P / U | Preceding account loses the internet reason. Candidate preserves it but treats choosing a specific activity as unfinished despite the chosen sample survey. Recent exchange lets its client continue with pairing. |
| Why offline? | P / X / X | P / U / U | Candidate correctly connects unreliable guest internet to offline data; preceding policy substitutes hands-on learning as the reason. Candidate's stored account still contains the stale activity-selection intention. |
| Return to pairing | P / U / P | P / P / U | Candidate returns to unknown-attendance pairing but its view also reopens activity selection. Its client nevertheless proposes flexible pairing. Preceding client refers to previously discussed options absent from the recorded transcript. |
| Return to export | P / U / U | P / X / X | Both store the Chromium result and untested Safari, alongside a stale implementation intention. Candidate view omits that stopping point and client asks where work stopped; preceding view and client recover Safari. |
| Return to staging | P / U / U | P / X / X | Candidate stores the successful repair but its view says the next step is staging outage resolution. Client repeats that false unfinished status. Export review/not-deployed state is also not retained clearly in storage. |
| Changed import diagnosis | P / U / U | P / U / P | Both retain malformed-input evidence but propose redundant confirmation in memory. Candidate client follows the changed diagnosis while misleadingly calling silent data loss robustness. |
| Current import understanding | U / P / X | P / P / X | Both views identify wording review, yet both clients ask generic next-step questions. Candidate additionally retains the obsolete plan to repeat the already completed fixture comparison. |
| Why Monday delivery? | U / U / U | U / U / U | Both retain Monday, the 48-hour flat-rest constraint, Thursday installation and pending supplier confirmation. Candidate adds the unprovided synonym “curing”; no curing process was established. The scheduling explanation itself stays grounded. |
| Return to labels | U / U / U | U / U / U | Both recover agreed short-label format and unresolved ordering while retaining dispatch evidence. |
| Why Birch room? | P / P / X | U / U / U | Preceding storage drops explicit unavailability; its client speculates about acoustics, capacity and suitability. Candidate preserves “unknown” and client acknowledges it. |
| Ask Birch reason again | P / P / X | U / U / U | Preceding client substitutes the event purpose for the room-selection reason. Candidate continues to acknowledge the missing rationale without inventing evidence. |

The rolling summaries and all rolling/recent-only client replies are identical across
the two runs. The rolling baseline preserves both the workshop's internet reason and
Birch's unknown rationale. For the fresh dispatch example, rolling and FOAM both
recover the timing reason while recent-only asks for context. For Birch, rolling
acknowledges missing evidence on both reads; recent-only lacks room context initially
and then invents a connection to introduction length and recording order. This run
does not establish an advantage over the rolling baseline.

## What changed on reads

The preceding policy changes no stored Markdown during the twelve reads. The candidate
changes it on three: current workshop plan, offline reason and return to export.
The offline-reason read adds an explicit, grounded causal sentence; the fact already
existed in stored memory. It is a change of emphasis, not newly discovered evidence.
Other access changes include restating current status and reformatting. These mutations
are not automatically successes: the stale activity-selection intention and poor
resumption view remain. No rule requiring either mutation or immutability was added.

## Decision

Retain the new evaluation coverage and both complete reports, but restore the preceding
default prompt. Targeted improvement is insufficient reason to accept the observed
resumption regressions. The candidate also takes 266.67 seconds of total call time
versus 188.29 seconds for the preceding policy; sequential order, caching/loading and
longer outputs confound any performance comparison.

The next useful investigation is to separate interpretation-policy behavior from
this model's ability to follow it, using the same frozen policies with another suitable
local model or repeated deployment settings. Further tuning solely against the workshop
would not establish general improvement. No additional model run is claimed here.

Mechanical validation: all 40 tests and both synthetic demos pass. This establishes
the runner and integration mechanics, not semantic reliability or readiness to publish.
