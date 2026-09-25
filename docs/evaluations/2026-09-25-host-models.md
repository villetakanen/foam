# Host-model integration probe — 2026-09-25

This evaluates the 0.3 integration against the existing partial-recollection rubric,
without changing the interpreter policy. Raw synthetic inputs and outputs are in
[the JSON report](2026-09-25-host-models.json).

## Method

Run `FOAM_REPORT=docs/evaluations/2026-09-25-host-models.json npm run eval:hosts`
with local Ollama serving the installed `gemma4:e4b`. The runner refuses cloud-model
entries, uses temporary Pi registry/auth paths, and supplies a dummy local credential
because the registry requires a configured provider even for an unauthenticated local
endpoint. An initial setup attempt lacked that credential and made no model calls;
the recorded run uses the corrected harness.

Both adapters use the same host provider path and model as the comparison clients.
The Pi path calls the session-registry adapter. The LangGraph path uses its model-only
callback interface backed by that registry; the separate executing graph test/demo uses
a shared LangChain chat model and checks event filtering. This live run therefore does
not test a LangChain provider package or a production graph transport.

The epic-reset and channel-switch fixtures start empty, then reopen persisted memory
with no recent transcript. Each includes a second access with no intervening client
outcome. A rolling summary and recent-only client supply comparisons. Calls have a
4096-token output limit, no provider retries, provider-default sampling, and a 60-second
evaluation timeout (the library default remains 30 seconds). These are synthetic probes,
not real file operations or Discord/WhatsApp delivery. No account credentials are used.

The completed run made 52 provider calls with zero protocol failures. This means
responses completed and passed the relevant response checks; it is not a semantic
pass rate. The integration suite also passed all 47 tests, actual Pi sessions on both
supported SDK versions, demos and clean package installation.

## Review

Useful association and client uptake are assessed separately. There is no aggregate
recall score or completeness threshold; a protocol success does not imply helpful memory.

| Host / encounter | Memory contribution | Client uptake |
| --- | --- | --- |
| Pi / resume epic | Mixed: partner-field constraint survives, but returned context omits the unobvious file references retained in Markdown. | Asks about priorities/options; does not recover the file connection. |
| Pi / supporting material | No demonstrated useful file association: repeats gathering material and partner naming, without identifying the retained references. | Repeats the framing rather than pointing to supporting material. |
| Pi / times again | Mixed: correct hours and last-entry time, but returned context omits the pool's identity. | Repeats correct hours without identifying the pool. |
| Pi / repeated times | Mixed: hours retained; memory upgrades “retrieved” to “confirmed” without new evidence and brings back the album task. | Repeats the stronger “confirmed” wording. |
| LangGraph / resume epic | Useful: both unobvious file references and their purpose reach the returned context. | Uses both references; also speculates about priorities/export types. This is client behavior, not evidence those options exist. |
| LangGraph / supporting material | Useful: both references and their roles survive another access. | Names both files and explains their use. |
| LangGraph / times again | Useful: identifies North Pool and recalls the correct hours/last entry. “Asking for confirmation” describes the cue, not new verification. | Gives the correct times with explicit pool attribution. |
| LangGraph / repeated times | Useful: same grounded subject/hours; no invented new confirmation in memory. | Supplies the same attributed hours. |

The Pi results illustrate why stored information and supplied recollection must be
reviewed separately. Retaining a file path somewhere in Markdown does not mean it
helped the next session. Likewise, correct numbers without a subject can fail to provide
the contextual awareness intended by the pool example. Read-induced confirmation drift
is a grounding issue, not evidence that all changes on read should be prevented.

These observations do not justify a comparison between adapters: one stochastic run
per path is confounded by model variation. They neither establish superiority to a
rolling summary nor prove compatibility with hosted providers or OAuth flows. The 0.3
change removes a second-backend setup requirement; memory-policy improvements remain
separate work.
