import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foam } from '../dist/index.js';
import { memoryNodes } from '../dist/adapters/langgraph.js';
import type { Access } from '../dist/index.js';
import { fixtureInference, cues } from './fixture.js';

const directory = await mkdtemp(join(tmpdir(), 'foam-graph-'));
try {
  const State = Annotation.Root({
    cue: Annotation<string>(), occurrence: Annotation<string>(), observations: Annotation<string[]>(),
    foamContext: Annotation<string>(), foamRevision: Annotation<number>(), foamAccess: Annotation<Access | undefined>(),
  });
  const foam = new Foam({ directory, scope: 'synthetic:alex', inference: fixtureInference });
  const nodes = memoryNodes(foam);
  const graph = new StateGraph(State)
    .addNode('prepare', nodes.prepare)
    .addNode('model', async state => {
      // Replace with your application model call, supplying state.foamContext once.
      console.log(state.foamContext);
      return { observations: ['The synthetic client displayed this memory context.'] };
    })
    .addNode('observe', nodes.observe)
    .addEdge(START, 'prepare').addEdge('prepare', 'model').addEdge('model', 'observe').addEdge('observe', END)
    .compile();
  let foamRevision = 0;
  for (const [i, cue] of cues.entries()) {
    const result = await graph.invoke({ cue, occurrence: `encounter-${i}`, observations: [], foamRevision });
    foamRevision = result.foamRevision;
  }
  console.log(`Completed real LangGraph execution at memory revision ${foamRevision}.`);
} finally { await rm(directory, { recursive: true, force: true }); }
