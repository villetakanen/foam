import { randomUUID } from 'node:crypto';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Foam } from '../core.js';
import { openProjectMemory } from '../project.js';
import { inferenceFromEnv } from '../inference.js';
import type { ExchangeMessage, Result, Snapshot } from '../types.js';

/** Extract visible text only; reasoning and image payloads are not memory observations. */
function visibleText(value: unknown): string {
  if (!value || typeof value !== 'object' || !('content' in value)) return '';
  const message = value as { content: unknown };
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content.filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text).join('\n');
}

export function registerFoam(pi: ExtensionAPI, binding: Foam | ((projectRoot: string) => Promise<Foam>)) {
  let foam: Foam | undefined;
  let recentExchange: ExchangeMessage[] = [];
  let cue = '';
  let prepared: Result | undefined;
  let revision: number | undefined;
  let disabled = true;
  const checkpoint = (result: Result) => {
    if (!foam) throw new Error('FOAM project is not open');
    revision = result.revision;
    pi.appendEntry('foam-revision', { scope: foam.scope, revision });
  };
  pi.on('session_start', async (_event, ctx) => {
    foam = undefined;
    disabled = true;
    revision = undefined;
    prepared = undefined;
    recentExchange = [];
    cue = '';
    let current: Snapshot;
    try {
      foam = typeof binding === 'function' ? await binding(ctx.cwd) : binding;
      current = await foam.inspect();
    } catch (error) {
      foam = undefined;
      ctx.ui.notify(`FOAM disabled: ${(error as Error).message}`, 'warning');
      return;
    }
    disabled = false;
    const saved = ctx.sessionManager.getBranch().filter(entry => entry.type === 'custom' && entry.customType === 'foam-revision').at(-1);
    revision = current.revision;
    if (saved?.type === 'custom') {
      const data = saved.data as { scope?: string; revision?: number } | undefined;
      if (data?.scope !== foam.scope || data?.revision !== current.revision) {
        disabled = true;
        ctx.ui.notify('FOAM disabled: session and scratchpad revisions differ. Use a matching scope snapshot or start a new session.', 'warning');
      }
    }
  });
  pi.on('before_agent_start', async event => { cue = event.prompt; prepared = undefined; });
  pi.on('context', async (event, ctx) => {
    const messages = event.messages.filter(message => !(message.role === 'custom' && message.customType === 'foam-context'));
    prepared = undefined;
    if (disabled || !foam) return { messages };
    recentExchange = messages.flatMap(message => {
      const role = message.role === 'toolResult' ? 'tool' : message.role;
      const text = visibleText(message);
      return text && (role === 'user' || role === 'assistant' || role === 'tool') ? [{ role, text } as ExchangeMessage] : [];
    }).slice(-8);
    try {
      const result = await foam.prepare({ cue, recentExchange, occurrence: randomUUID(),
        ...(revision !== undefined ? { expectedRevision: revision } : {}) });
      checkpoint(result);
      if (result.diagnosticLoss?.length) ctx.ui.notify(result.diagnosticLoss.join('; '), 'warning');
      prepared = result;
      return { messages: [...messages, {
        role: 'custom' as const, customType: 'foam-context', content: result.context,
        display: false, timestamp: Date.now(),
      }] };
    } catch (error) {
      ctx.ui.notify(`FOAM preparation skipped: ${(error as Error).message}`, 'warning');
      return { messages };
    }
  });
  pi.on('turn_end', async (event, ctx) => {
    if (!prepared || disabled || !foam) return;
    const result = prepared;
    prepared = undefined;
    try {
      const next = await foam.observe({ cue, recentExchange: [...recentExchange,
        { role: 'assistant' as const, text: visibleText(event.message) },
        ...event.toolResults.map(tool => ({ role: 'tool' as const, text: `${tool.toolName} (${tool.isError ? 'error' : 'result'}): ${visibleText(tool)}` })),
      ].slice(-8), occurrence: result.access.occurrence,
        expectedRevision: result.revision, access: result.access, suppliedContext: result.context,
        observations: [visibleText(event.message), ...event.toolResults.map(tool => `${tool.toolName} (${tool.isError ? 'error' : 'result'}): ${visibleText(tool)}`)].filter(Boolean) });
      checkpoint(next);
      if (next.diagnosticLoss?.length) ctx.ui.notify(next.diagnosticLoss.join('; '), 'warning');
    } catch (error) { ctx.ui.notify(`FOAM observation skipped: ${(error as Error).message}`, 'warning'); }
  });
  // FOAM cannot rewind external Markdown with Pi's conversation tree.
  pi.on('session_before_tree', async (_event, ctx) => {
    ctx.ui.notify('FOAM requires a separate scratchpad snapshot for tree navigation.', 'warning');
    return { cancel: true };
  });
  pi.on('session_before_fork', async (_event, ctx) => {
    ctx.ui.notify('FOAM requires a separate scratchpad snapshot for forks.', 'warning');
    return { cancel: true };
  });
  pi.registerCommand('foam', {
    description: 'Inspect current FOAM Markdown and revision without an encounter',
    handler: async (_args, ctx) => {
      if (!foam) { ctx.ui.notify('FOAM project is not open', 'warning'); return; }
      const status = await foam.status();
      await ctx.ui.editor(`FOAM ${status.snapshot.scope} · revision ${status.snapshot.revision} (inspection only)`, JSON.stringify(status, null, 2));
    },
  });
}

export default function foamExtension(pi: ExtensionAPI) {
  if (!process.env.FOAM_SCOPE) throw new Error('Set FOAM_SCOPE to the explicitly authorized scope');
  const scope = process.env.FOAM_SCOPE;
  if (process.env.FOAM_MODE === 'legacy') {
    if (!process.env.FOAM_DIRECTORY) throw new Error('Legacy mode requires FOAM_DIRECTORY');
    registerFoam(pi, new Foam({ directory: process.env.FOAM_DIRECTORY, scope, inference: inferenceFromEnv() }));
  } else {
    if (process.env.FOAM_MODE && process.env.FOAM_MODE !== 'project') throw new Error('Invalid FOAM_MODE');
    registerFoam(pi, projectRoot => openProjectMemory({ projectRoot, scope }));
  }
}
