# FOAM 0.1.0 evaluation

## Mechanical verification

Node 24.14.0 locally, plus GitHub CI on Node 22 and 24. Sixteen deterministic tests
cover core failure handling, scope and revision boundaries, shared Pi/LangGraph inputs,
and an actual Pi SDK session delivering a context block and observing its response.
`npm run demo:graph` runs the shared scenario in a real LangGraph graph. Pi 0.86.0's
extension loader also loaded the compiled entry point without errors.

The release tarball was installed into a clean temporary consumer and its core and
LangGraph helper executed successfully. Package contents were inspected for personal
study material, scratchpads and credentials; none were included.

## Live protocol

Three trials of six synthetic encounters: leaking sink, travel interruption, repair
resumption, explicit completion, old reminder, repeated old reminder. Each encounter
prepares context then reports exposure through observe. Each operation gets one model
call and a 30-second timeout. The test client reports display, not real-world action.

The reference backend was tested locally with Ollama 0.34.0 and the already installed
`gemma4:e4b` model. Raw traces, metrics, failures and preserved snapshots are in
[evaluation-live.json](evaluation-live.json). An unchanged compact note supplies the
baseline; it has zero inference calls and deliberately has no update mechanism.
This is a diagnostic baseline, not a comparison with a competitive memory system.

The follow-on text-only client probe presents the latest successfully evoked old-cue
context and, separately, the baseline to the same model. It records suggested replies
in [evaluation-live-client.json](evaluation-live-client.json). Failed old-cue preparation
is reported as skipped, not silently counted as correct behaviour. No tools are run.

Reproduce from a checkout with a configured endpoint and installed model:

```sh
FOAM_TRIALS=3 npm run eval:live
npm run eval:client
```

Reports default to ignored `.foam/`; `FOAM_REPORT` selects an explicit destination.
Inspect unsupported additions, loss of unrelated activity, access-driven changes,
completion handling and suggested stale actions. Byte counts are measured; token counts
are not claimed without a tokenizer. Latency depends on hardware, load and model settings.

## Results and changes

| Run | Completed prepare + observe pairs | Protocol failures |
| --- | ---: | --- |
| Initial prompt, JSON-object mode | 11 / 18 | 4 invalid schemas, 2 timeouts, 1 incomplete response |
| Revised grounding prompt, strict JSON schema | 18 / 18 | 0 |

The revised run made 36 memory inference calls. Returned contexts were 104–221 UTF-8
bytes; median preparation latency was 12,959 ms and median observation latency was
15,286 ms. That overhead is substantial for an interactive client. These timings
exclude the downstream client comparison and are specific to this local run.

The initial model invented anxiety, urgency, verification, documentation and sign-off
requirements after completion. See [initial traces](evaluation-initial.json) and
[initial client probe](evaluation-initial-client.json). We added explicit rules against
unsupported obligations and emotional interpretations, a preference for compact neutral
prose, and strict JSON-schema response formatting. The initial implementation is commit
`187ecd4`; the revised interpreter is `9137824`. Both trials are retained; changing two
variables at once does not isolate their individual effects on semantic quality.

Manual inspection of the revised traces finds:

- Completion remains represented in all three final scratchpads. The old-cue contexts
  do not suggest booking the plumber again, although one omits a useful status answer.
- Evoked views often describe the latest cue instead of supplying a useful continuation.
  This is a substantive weakness even when the protocol succeeds.
- The unrelated travel activity disappears from the final scratchpads in trials 1 and 3.
  Whole-set analysis and the prompt do not guarantee preservation of unrelated activity.
- Trial 3's final note infers a renewed need to verify the plumbing status from a repeated
  cue. Unsupported interpretation is reduced in these examples but remains unresolved.
- Trial 2 narrates a shift back to travel that the encounter did not explicitly establish.

These residual failures are part of the 0.1.0 result, not passes hidden behind a schema
check. The next experiment should assess grounded continuation, unrelated-activity
preservation and access-driven drift across stronger and smaller models.

## Text-only client probe

The revised probe completed 3 of 6 requests: two FOAM-context responses and one
unchanged-note response. Three outputs contained Markdown code fences instead of valid
JSON and were rejected despite the requested response schema. Provider-side formatting
is therefore not assumed reliable; runtime validation remains necessary.

The two parseable FOAM-context replies retained the resolved repair state, but were
largely paraphrases of the memory/cue rather than helpful user-facing answers. The
parseable baseline reply repeated the obsolete waiting state. With half the responses
invalid, no comparative success rate or stale-action advantage can be inferred.
There were no real-world actions. Full responses and errors are retained in the client
report, including failures rather than retrying until a favourable answer appeared.

## Interpretation limits

These are small exploratory trials, with model sampling variability and no blinded
rating. The fixtures encode expected behaviour and are not evidence of semantic quality.
The live model can produce invalid schemas, time out or omit relevant context. Failed
operations preserve the previous committed scratchpad; a successful prepare can still
remain committed if its subsequent observe fails. There is no encounter-wide transaction.

No claim of biological fidelity, improved task success, or superiority over other memory
systems follows from this release. Model-policy comparison, stronger downstream-agent
evaluation and broader scenarios remain future experiments.
