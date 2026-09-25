# Changelog

## 0.3.0 — 2026-09-25

- Pi defaults to its active model and provider authentication; model changes apply to
  the next memory operation. Tested with Pi 0.86.0 and 0.87.0.
- LangGraph applications can pass an existing chat model or routing callback, with
  cancellation and tagged calls for filtering memory output from visible streams.
- Explicit adapters and configured project backends retain precedence. No fallback
  on provider failure; no memory-policy or storage migration.
- Read-only status and diagnostics include backend identity when supplied. Pi retains
  the actual initialization error for inspection.


## 0.2.0 — 2026-09-24

- Make partial-recollection probes the default semantic eval: fresh-session file
  associations, simulated cross-channel subject recognition and ambiguous cues.
  Credit useful clarification without demanding complete recall; retain the prior
  activity suite as `eval:activity`. Interpreter policy remains unchanged.
- Clarify FOAM's purpose as fleeting, partial recollection that adds contextual
  awareness. Add the vision and session-reset/cross-channel examples; distinguish
  intended behavior from current policy and historical evaluation judgements.
- Add dispatch-timing and unknown-room-rationale evaluations. Compare a candidate
  policy for retaining decision reasons and missing evidence; retain the preceding
  default after observed resumption regressions. Preserve both reports for review.
- Ask both observations and reads to synthesize the current activity, reconcile
  superseded intentions, and recover relevant earlier context. Extend the workshop
  evaluation with successive changes of attention; neither rewriting nor preserving
  memory verbatim is treated as success by itself.
- Replace radiator-based semantic release thresholds with three continuous activity evaluations:
  unfolding work, resumption, and revised understanding. Compare a rolling summary and
  recent exchange, with memory and natural-language client replies reviewed separately.

- Add versioned project configuration, initialization, inspection and migration CLI,
  shared by Pi, LangGraph and embedded clients with explicit scope binding.
- Export a bounded JSON-envelope decoder and response schema for HTTP/in-process adapters.
- Add role-labelled recent exchanges, correlation, diagnostics sinks and bounded opt-in traces.
- Preserve entity/fact relationships and reference continuity in the grounded policy.
- Add ownership-aware local writer recovery with conservative offline repair for unknown locks.
- Add crash-boundary tests, synthetic semantic cases, an enabled/disabled evaluation runner
  and an embedded example. Model-quality release gates remain separately reported.
- Pi defaults to project mode; select `FOAM_MODE=legacy` for the 0.1 environment setup.


## 0.1.0 — 2026-09-20

First experimental release of evolving Markdown working memory for agents.

- Host-independent TypeScript `prepare`, `observe` and `inspect` operations.
- Explicit scopes, independent memory/input/context budgets, revision checks,
  writer exclusion, atomic replacement and validated inference responses.
- Replaceable interpreter and configurable JSON chat-completions backend.
- Pi lifecycle extension with inspection and stale-session protection.
- LangGraph node helpers and runnable graph example.
- Shared synthetic scenarios, failure tests and repeated live evaluation runner.
- MIT license, public source, installable release tarball and Node CI.

This release tests an engineering hypothesis, not validated biological fidelity.
No claim of memory quality superiority; read the evaluation report and limitations.
