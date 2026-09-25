// An executing graph with a shared deterministic model; replace it with your app's model.
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeProject, openProjectMemory } from '../dist/index.js';
import { langGraphInference, memoryNodes, MEMORY_CALL_TAG } from '../dist/adapters/langgraph.js';
const proposal = { markdown: 'Pool hours may be relevant.', context: 'Possibly pool hours.' };
const root = await mkdtemp(join(tmpdir(), 'foam-shared-demo-'));
try {
  await initializeProject(root);
  const model = new FakeListChatModel({ responses: [JSON.stringify(proposal), 'Do you mean the pool hours?', JSON.stringify(proposal)] });
  const foam = await openProjectMemory({ projectRoot: root, scope: 'private', hostInference: langGraphInference(model) });
  const State = Annotation.Root({ cue: Annotation<string>(), occurrence: Annotation<string>(), observations: Annotation<string[]>(),
    foamRevision: Annotation<number>(), foamContext: Annotation<string>(), foamAccess: Annotation<any>() });
  const nodes = memoryNodes(foam);
  const graph = new StateGraph(State).addNode('prepare', nodes.prepare).addNode('reply', async state => {
    const reply = await model.invoke([{ role: 'system', content: state.foamContext }, { role: 'user', content: state.cue }]);
    return { observations: [String(reply.content)] };
  }).addNode('observe', nodes.observe).addEdge(START, 'prepare').addEdge('prepare', 'reply').addEdge('reply', 'observe').addEdge('observe', END).compile();
  const visible: unknown[] = [];
  let hidden = 0;
  for await (const event of graph.streamEvents({ cue: 'Times again?', occurrence: 'graph-one', observations: [] }, { version: 'v2' })) {
    if (event.event !== 'on_chat_model_end') continue;
    if (event.tags?.includes(MEMORY_CALL_TAG)) { hidden++; continue; }
    visible.push(event.data.output.content);
  }
  console.log({ visible, hiddenMemoryCalls: hidden, revision: (await foam.inspect()).revision });
} finally { await rm(root, { recursive: true, force: true }); }
