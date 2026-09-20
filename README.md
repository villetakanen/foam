# FOAM

Small, evolving Markdown working memory for agents. FOAM keeps track of the changing
situation around an activity: what happened, what is still relevant, and what no
longer needs doing. A completed repair can come back to mind without becoming a new
instruction to book the plumber.

**0.1.0 is experimental.** The TypeScript core, Pi extension and LangGraph helpers
share one replaceable inference policy. Biological research motivates hypotheses;
FOAM is not a validated cognitive model. See [evaluation](docs/evaluation.md).

## Install

Node **22.19 or newer**. The built package is distributed through the GitHub release;
there is no npm registry publication yet.

```sh
npm install https://github.com/villetakanen/foam/releases/download/v0.1.0/villetakanen-foam-0.1.0.tgz
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
For tokenizer-aware admission, supply both `countTokens` and `maxInputTokens`; byte
counts alone do not establish a model's token usage. Applications must account for
the provider's message framing and output reserve in their model context window.

## Pi quickstart

Tested with `@earendil-works/pi-coding-agent@0.86.0` (the current package namespace).
From a source checkout after `npm ci && npm run build`:

```sh
export FOAM_DIRECTORY="$PWD/.foam/pi-private"
export FOAM_SCOPE=demo:private
# Set the inference variables above first.
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
FOAM 0.1.0 has no cross-store transaction or automatic checkpoint rewind.

## Persistence and limitations

`memory.md` contains scope/revision frontmatter and ordinary Markdown activity sections.
An exclusive `.writer.lock` directory serializes cooperating writers. A temporary file
is flushed then atomically renamed. Failures before rename preserve the previous file;
content hashes also detect manual edits during inference. Local trusted filesystems only.
Manual editors must respect the lock; arbitrary external edits are not transactional.
Filesystem/power-loss durability beyond the atomic rename is not guaranteed.

A crash can leave a lock. Confirm that no process is using this scope before manually
removing its `.writer.lock` directory and any `.memory-*.tmp` files. FOAM does not
silently steal locks. Keep credentials and scratchpads out of version control.

The interpreter can hallucinate, omit useful context or fail to release stale intentions.
Clients must treat memory as provisional context. FOAM is not a task manager, identity
resolver, search database or distributed memory service. Python and other host adapters
are deferred.

## Project practices

[ASDLC.io](https://asdlc.io/practices/) is our practices library. The
[living contract](specs/memory/spec.md), [architecture decision](docs/decisions/0001-markdown-core.md)
and [contribution guide](CONTRIBUTING.md) explain the working agreements.
Only implementation and synthetic examples are published; local study collateral is excluded.

[MIT licensed](LICENSE). Copyright 2026 Ville Takanen.
