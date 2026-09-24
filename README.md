# FOAM

Fleeting, partial memory that adds contextual awareness to an agent. An experience
leaves an impression; a later encounter can bring some of it back. **Partial
recollection can be enough to help**—a useful detail, a connection to a file, or a
tentative sense of what the user means.

For example:

- After you clear an agent session while working on an epic, FOAM may recall that
  some otherwise unobvious files matter. It might supply the information, point the
  agent toward the files, or help it ask you a useful question.
- You discuss swimming-pool hours on Discord, then ask “What were the times again?”
  on WhatsApp. Recalling enough to ask “Do you mean the swimming-pool opening hours?”
  is useful even without remembering the hours themselves.

These are intended experiences, not reliability claims or bundled chat integrations.
The host explicitly controls shared memory scope across sessions or channels.
See [the vision](VISION.md) for the purpose, examples and unresolved design questions.

**0.2.0 is an experimental release.** The TypeScript core, Pi extension and LangGraph helpers
share one replaceable inference policy. Biological research motivates hypotheses;
FOAM is not a validated cognitive model. Its current policy and
[partial-recollection evaluations](docs/evaluations/partial-recollection-v1.md) now
exercise the two examples above and an ambiguous cue. The interpreter policy still
needs assessment against this purpose. Earlier task-state completeness judgements
remain historical diagnostics.

## Install

Node **22.19 or newer**. The package is distributed through GitHub releases;
there is no npm registry publication.

```sh
npm install https://github.com/villetakanen/foam/releases/download/v0.2.0/villetakanen-foam-0.2.0.tgz
```

For development and the reproducible synthetic demos:

```sh
git clone https://github.com/villetakanen/foam.git
cd foam
npm ci
npm run check
npm run demo
npm run demo:graph
```

The demos use an explicitly scripted inference fixture and fictional data. The graph
demo executes LangGraph; it does not call an application LLM.

## Project setup (0.2)

After installing 0.2, initialize the project explicitly:

```sh
npx foam init "$PWD" private
npx foam status "$PWD" private
```

`foam.config.json` is shareable; `.foam/` is ignored runtime state. The initializer
preserves existing files and settings. Configure a backend or inject an adapter:

```json
{
  "version": 1,
  "policyVersion": "0.2",
  "memoryRoot": ".foam",
  "scopes": {
    "private": { "directory": "private" },
    "team": { "directory": "team" }
  },
  "budgets": { "maxMemoryBytes": 12288, "maxInputBytes": 20480, "maxContextBytes": 2048, "timeoutMs": 30000 },
  "inference": { "endpoint": "http://127.0.0.1:11434/v1/chat/completions", "model": "gemma4:e4b" },
  "trace": { "maxBytes": 65536, "maxRecords": 100 }
}
```

For an authenticated backend, add `"apiKeyEnv": "MY_MODEL_KEY"` to `inference` and
set that variable outside the config. Never put credentials in the file or URL.
Backend performance and quality depend on the model; this is not a model endorsement.
The JSON schema version and policy version are distinct. Unknown fields are rejected.

```ts
import { openProjectMemory } from '@villetakanen/foam';
const foam = await openProjectMemory({ projectRoot: process.cwd(), scope: 'private' });
// Embedded clients can instead pass inference: myInProcessAdapter.
```

The host chooses and authorizes the scope. No parent-directory search, client-name
access control or inference of scope from conversation occurs. Relative paths must
stay below the configured root; aliases, nested scopes and symlinks are rejected.
Direct `new Foam(...)` remains available for application-owned scopes such as a household.

## Core

```ts
import { Foam, inferenceFromEnv } from '@villetakanen/foam';

const foam = new Foam({
  directory: './.foam/alex-private',
  scope: 'alex:private', // Explicit authorization boundary chosen by your application.
  inference: inferenceFromEnv(),
});
const prepared = await foam.prepare({
  cue: 'What happened with the sink repair?',
  occurrence: crypto.randomUUID(),
});
// Supply prepared.context once to your agent as fallible memory, not instructions.
// After your agent actually receives it and produces an outcome:
await foam.observe({
  cue: 'What happened with the sink repair?',
  occurrence: prepared.access.occurrence,
  access: prepared.access,
  suppliedContext: prepared.context,
  expectedRevision: prepared.revision,
  observations: ['The user confirmed that the plumber finished the repair.'],
});
console.log(await foam.inspect()); // Instrumentation; no inference or memory change.
```

Use one dedicated directory per authorized audience/scope. The application controls
who may read it; scope labels are not authentication. Never point a scratchpad at a
personal vault or automatically derive its scope from a model response.

`prepare` and `observe` can both rewrite `memory.md`. Each successful operation
advances its revision, even when text stays the same. Repeated encounters may change
memory. `inspect` never counts as an encounter. Returned access IDs identify occurrences;
they are not delivery receipts or retry-deduplication keys.

## Inference configuration

Supply an explicit model and complete chat-completions endpoint. For an installed
local Ollama model, start `ollama serve` and use:

```sh
export FOAM_ENDPOINT=http://127.0.0.1:11434/v1/chat/completions
export FOAM_MODEL=gemma4:e4b
# For authenticated endpoints, set FOAM_API_KEY in your shell/secret manager.
```

The reference backend requests strict JSON-schema output and a complete `stop` response.
It uses one request per operation, with no automatic retries, a 30-second default
timeout and 4,096 output-token limit. Provider compatibility varies. A hosted endpoint
receives the authorized scratchpad and supplied experience; local endpoints keep those
requests local. Remote endpoints require HTTPS and redirects are rejected.

You can supply any in-process `InferenceAdapter` implementing
`infer(input, signal): Promise<unknown>`. The core validates its result as exactly
`{ markdown: string, context: string }`. Return the complete replacement Markdown.
The prompt is exported as `INTERPRETER_PROMPT` for experiments.

Default limits are 12,288 UTF-8 bytes of Markdown, 20,480 bytes of complete serialized
analysis input and 2,048 bytes of returned context. These are independent budgets,
not biological constants. Oversize input/output fails without truncation or replacement.
For tokenizer-aware admission, supply `countTokens` and `maxInputTokens`. Add
`maxTotalTokens` and `outputTokenReserve` to admit input plus the output reserve.
The tokenizer must include provider framing; byte counts are not portable token counts.

## Pi quickstart

Tested with `@earendil-works/pi-coding-agent@0.86.0` (the current package namespace).
From a source checkout after `npm ci && npm run build`:

```sh
node dist/cli.js init "$PWD" private
# Configure inference in foam.config.json as shown above.
export FOAM_SCOPE=private
npx pi -e ./dist/adapters/pi.js
```

For a tarball installation, install Pi separately and use
`pi -e ./node_modules/@villetakanen/foam/dist/adapters/pi.js`.
The package also declares its extension in Pi package metadata.

Try: “The sink is leaking; Alex is waiting for the plumber appointment.” Then switch
to planning a train trip, return to the repair, report completion, and mention an old
plumber reminder. `/foam` opens a read-only inspection view (editor changes are discarded).

The extension prepares a fresh block at every `context` event and removes earlier
FOAM blocks. `turn_end` supplies visible assistant text and actual tool results.
Reasoning and images are excluded. Each context event is a distinct encounter;
provider-internal retries or a later extension changing the payload are not observable
proof of exposure. Errors notify the user and omit stale context while Pi continues.
Large tool output may exceed the analysis budget and skip an observation.

Pi tree navigation/forking is cancelled while the extension is active. External
Markdown cannot rewind with the session. Resuming a recorded session whose revision
no longer matches disables memory with a notice. Use a matching scratchpad snapshot,
or a fresh session with the current explicitly authorized scope. With a custom model
adapter, call `registerFoam(pi, foam)` from your own extension.

## LangGraph quickstart

Tested with `@langchain/langgraph@1.4.16`. Install that package separately; FOAM's
helpers do not require it at runtime. See the complete [graph example](examples/langgraph.ts).

```ts
import { memoryNodes } from '@villetakanen/foam/langgraph';
const memory = memoryNodes(foam);
// Compose: START -> memory.prepare -> your model node -> memory.observe -> END.
// Your model node supplies state.foamContext once and returns observations: string[].
```

State carries `cue`, `occurrence`, `observations`, `foamRevision`, `foamContext` and
`foamAccess`. The prepare helper sets the memory fields; observe records exposure and
results, advances the revision, and clears the transient context/access fields.

Checkpoint all memory fields. A stale expected revision fails; never drop it just to
make a replay succeed. If a crash occurs between Markdown commit and graph checkpoint,
reconcile explicitly. For branching, copy the scratchpad while no writer is active
into a separately configured directory, and keep the matching scope/revision state.
FOAM has no cross-store transaction or automatic checkpoint rewind.

## Encounters, decoding and inspection

Supply `recentExchange` as ordered `{ role: 'user' | 'assistant' | 'tool', text,
sourceRef? }` records, with optional `correlationId` and `sourceRefs`. The exchange
limit is 32 messages / 8192 serialized bytes, inside the overall input budget.
Pi selects the last eight visible messages and records final assistant/tool outcomes;
LangGraph state and embedded callers supply the same fields explicitly. Missing
history remains missing. The host owns pending tasks, confirmations and tool execution.

For embedded model responses, use `decodeInterpretation(raw)`, return its
`interpretation`, and report `normalized` through the optional third `infer` argument.
The decoder accepts plain JSON or one complete empty/`json` Markdown fence; commentary,
multiple blocks, wrong fields/types, malformed or oversized output fail. Exported
`interpretationSchema` supports constrained generation. Core validation always runs.
See [the embedded example](examples/embedded.ts), which needs no HTTP service.

Pass `diagnostics(record)` to receive operation phases, correlation, revisions,
normalization, timing and outcomes. Opt into `diagnosticDetails: true` for before/after
Markdown and supplied context. Optional `trace` limits enable an atomic local ring;
old records rotate, oversized records report loss. Trace history is never model input.
`foam.status()`, the CLI inspection command and Pi `/foam` inspect without inference.
`result.diagnosticLoss` reports sink/trace/cleanup failures without disguising a commit
as a failed memory operation. Sinks have a one-second deadline. LangGraph exposes losses
as `foamDiagnosticLoss`. Observation reports supply separately; it does not prove attention.

## Migrating 0.1

Keep direct constructor use as-is. For project mode, initialize configuration and set
a scope's optional `scope` label to the exact old scope, for example
`"private": { "directory": "private", "scope": "alex:private" }`. Existing
`.foam/private` snapshots can be used in place. To copy another old directory:

```sh
npx foam migrate "$PWD" private /absolute/path/to/old-memory
npx foam inspect "$PWD" private
```

Migration validates and preserves the scope, revision and Markdown, refuses an occupied
destination, and leaves the source unchanged. Legacy environment-based Pi setup is
explicit: set `FOAM_MODE=legacy`, `FOAM_DIRECTORY`, `FOAM_SCOPE`, `FOAM_MODEL` and
`FOAM_ENDPOINT`. These variables never silently override project configuration.

## Persistence and limitations

`memory.md` contains scope/revision frontmatter and free-form Markdown memory.
An exclusive `.writer.lock` directory serializes cooperating writers. A temporary file
is flushed then atomically renamed. Failures before rename preserve the previous file;
content hashes also detect manual edits during inference. Local trusted filesystems only.
Manual editors must respect the lock; arbitrary external edits are not transactional.
Filesystem/power-loss durability beyond the atomic rename is not guaranteed.

A crash can leave an owned lock. `foam recover <project-root> <scope>` recovers only
when a recorded local owner PID is absent. It never steals from a live PID (including
a reused PID) or uses elapsed time as proof. It reports an unknown commit outcome:
inspect the revision before deciding whether to retry an encounter.

Legacy empty locks, foreign/unknown owners and an abandoned `.coordination.lock`
require offline operator repair: stop every client of that scope, inspect `memory.md`,
then remove the verified stale lock/gate and leftover `.memory-*.tmp` files. Do not
remove locks while another client can acquire or release them. Keep credentials and
scratchpads out of version control.

The interpreter can hallucinate, miss a useful association or revive an obsolete intention.
Clients must treat memory as provisional context. FOAM is not a task manager, identity
resolver, search database or distributed memory service. Python and other host adapters
are deferred.

## Project practices

See the [roadmap](ROADMAP.md) and [0.2 delivery plan](docs/releases/0.2.0-plan.md) for scope and release gates.

[ASDLC.io](https://asdlc.io/practices/) is our practices library. The
[living contract](specs/memory/spec.md), [architecture decision](docs/decisions/0001-markdown-core.md)
and [contribution guide](CONTRIBUTING.md) explain the working agreements.
Only implementation and synthetic examples are published; local study collateral is excluded.

[MIT licensed](LICENSE). Copyright 2026 Ville Takanen.

## Evaluating partial recollection

`FOAM_MODEL=<installed-local-model> npm run eval:semantic` starts with empty memory,
replays fictional experience, then clears conversation context and reopens persisted
memory. It probes unobvious file associations after a session reset, recognition of
pool hours across simulated channels, and a cue with multiple possible subjects.

A useful association or focused clarification counts without a complete answer.
Compare FOAM, a rolling summary and a client with no pre-reset context; review memory
contribution and client uptake separately. See the
[protocol](docs/evaluations/partial-recollection-v1.md) for limits and reproduction.
These are simulated encounters, not live chat integrations or proven reliability.

The previous activity-reconstruction suite remains available as `npm run eval:activity`,
and the radiator suite as `npm run eval:semantic:legacy`. Their reports retain the
original observations and judgements.
