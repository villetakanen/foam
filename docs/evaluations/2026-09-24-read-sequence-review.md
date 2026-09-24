# Successive reads and revised interpretation policy — 2026-09-24

The policy change improves the workshop's current account but regresses recall of
why the exercise is offline. It is an experimental change, not a demonstrated overall
improvement. No stored Markdown changes during the reads in either run, so these
results do not demonstrate useful reconstruction of stored memory on access.

## Matched comparison

- [Existing policy report](2026-09-24-read-sequence-before.json)
- [Revised policy report](2026-09-24-read-sequence-after.json)
- [Evaluation protocol](activity-memory-v1.md)

Both reports use the same extended unfolding-work fixture (verified identical fixture
hash), installed `gemma4:e4b` model digest, byte budgets, temperature 0, seed 42 and
client/rolling-summary prompts. Their interpreter-policy hashes differ. Each begins
with empty memory and runs four exchanges, four read checkpoints and twelve client
probes: 24 calls, with zero protocol failures. Client order is FOAM, rolling, recent-only
throughout. Each read commits before the next read. Client replies are never fed back
as observed outcomes; the recent transcript window and rolling summary stay unchanged
through the final three reads.

The intervention is the complete prompt revision, including its additional length;
this is not an ablation of individual sentences. One run per condition is diagnostic,
not a statistical reliability estimate. Only unfolding work was rerun for this change;
the previous resumption/revision results do not evaluate the revised policy.

## Agent-authored review

The ratings below assess stored memory, the focused view with its available recent
exchange, and the actual client reply separately. Changes in wording alone earn no
credit. Neither a mandatory rewrite nor a fixed output outline is required.

| Read | Existing policy | Revised policy |
| --- | --- | --- |
| Venue options | **Memory partly usable:** generic compare-venues intention; audience and new constraints missing. **View partly usable:** mostly repeats venue lookup. **Client partly usable:** accurate venue recap but little broader orientation. | **Memory usable:** purpose, twelve beginners, accessible Tide at €80 and unresolved activity retained. **View usable:** retrieves audience and practical activity. **Client usable:** continues toward choosing the exercise. Neither memory nor client claims a booking. |
| Current plan | **Memory partly usable:** stale intention to compare venues persists beside newer facts. **View partly usable:** pairing focus without earlier rationale. **Client usable:** flexible pairing proposals, attendance still unknown. | **Memory partly usable:** correctly consolidates Tide, offline sample survey and pairing focus, but drops unreliable internet, headcount and explicit no-booking state. **View partly usable:** current direction is clear, rationale absent. **Client usable:** proposes possible arrangements without claiming one is agreed. |
| Why offline? | **Memory partly usable:** earlier problems remain, but internet evidence survives. **View usable; client usable:** correctly recover unreliable guest internet as the reason. | **Memory partly usable:** no new distortion in storage, but the causal evidence is still absent. **View unusable; client unusable:** replace the actual reason with the broader hands-on learning goal. |
| Return to pairing | **Memory partly usable:** still stale in places. **View usable; client usable:** recover pairing, unknown attendance and no settled mechanism. | **Memory partly usable:** remains coherent about current work but still loses prior rationale. **View usable:** returns to pairing without inventing attendance. **Client partly usable:** identifies the stopping point but offers to revisit “options we discussed,” although the recorded transcript never discussed specific options. Earlier generated probe suggestions are not observed history. |

The rolling-summary condition retains unreliable internet and returns the correct
offline rationale in both runs. Recent-only responds tautologically that offline was
chosen because an offline format was planned. That contrast makes this read a useful
probe of earlier causal context rather than just the last message.

## Where the regression occurs

After the third exchange, revised-policy memory still says Tide's guest internet is
unreliable and connects this to using a prepared local dataset. After the fourth
exchange, it consolidates the current plan and drops that reason. Both subsequent
reads therefore start without the evidence needed to answer why offline was chosen.
The reason is not lost during a read: it is lost during observation. The rationale
read then exposes an unsupported causal substitution in returned context, which the
client repeats. Stored memory itself remains unchanged.

This separates three questions: whether observation preserves useful relationships,
whether reading reconstructs them faithfully, and whether the responding client uses
the result. The clearer final summary answers only part of the first question.

## Implication and verification

The next policy investigation should target preservation of decision–reason
relationships during consolidation, and explicit uncertainty when a requested reason
is absent. More randomness would not directly address the observed loss of evidence.
The proposed direction should be tested on fresh activities with different causal
relationships, not only by tuning wording until this visible workshop succeeds.

The revised policy remains in the unreleased working tree for inspection with this
regression recorded. There is no release-quality claim or publication from this run.
`npm run check` passes all 40 tests, including chained access state and branch-isolation
checks; both synthetic demos pass. These establish mechanics, not semantic quality.
