import { randomUUID } from 'node:crypto';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Foam } from '../core.js';
import { inferenceFromEnv } from '../inference.js';
import type { Result } from '../types.js';

/** Extract visible text only; reasoning and image payloads are not memory observations. */
function visibleText(value: unknown): string {
  if (!value || typeof value !== 'object' || !('content' in value)) return '';
  const message = value as { content: unknown };
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content.filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text).join('\n');
}

export function registerFoam(pi: ExtensionAPI, foam: Foam) {
  let cue = '';
  let prepared: Result | undefined;
  let revision: number | undefined;
  let disabled = false;
  const checkpoint = (result: Result) => {
    revision = result.revision;
    pi.appendEntry('foam-revision', { scope: foam.scope, revision });
  };
  pi.on('session_start', async (_event, ctx) => {
    prepared = undefined;
    cue = '';
    disabled = false;
    const saved = ctx.sessionManager.getBranch().filter(entry => entry.type === 'custom' && entry.customType === 'foam-revision').at(-1);
    const current = await foam.inspect();
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
    if (disabled) return { messages };
    try {
      const result = await foam.prepare({ cue, occurrence: randomUUID(),
        ...(revision !== undefined ? { expectedRevision: revision } : {}) });
      checkpoint(result);
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
    if (!prepared || disabled) return;
    const result = prepared;
    prepared = undefined;
    try {
      const next = await foam.observe({ cue, occurrence: result.access.occurrence,
        expectedRevision: result.revision, access: result.access, suppliedContext: result.context,
        observations: [visibleText(event.message), ...event.toolResults.map(tool => `${tool.toolName} (${tool.isError ? 'error' : 'result'}): ${visibleText(tool)}`)].filter(Boolean) });
      checkpoint(next);
    } catch (error) { ctx.ui.notify(`FOAM observation skipped: ${(error as Error).message}`, 'warning'); }
  });
  // 0.1.0 cannot rewind external Markdown with Pi's conversation tree.
  pi.on('session_before_tree', async (_event, ctx) => {
    ctx.ui.notify('FOAM 0.1.0 requires a separate scratchpad snapshot for tree navigation.', 'warning');
    return { cancel: true };
  });
  pi.on('session_before_fork', async (_event, ctx) => {
    ctx.ui.notify('FOAM 0.1.0 requires a separate scratchpad snapshot for forks.', 'warning');
    return { cancel: true };
  });
  pi.registerCommand('foam', {
    description: 'Inspect current FOAM Markdown and revision without an encounter',
    handler: async (_args, ctx) => {
      const snapshot = await foam.inspect();
      await ctx.ui.editor(`FOAM ${snapshot.scope} · revision ${snapshot.revision} (inspection only)`, snapshot.markdown);
    },
  });
}

export default function foamExtension(pi: ExtensionAPI) {
  if (!process.env.FOAM_DIRECTORY || !process.env.FOAM_SCOPE) throw new Error('Set FOAM_DIRECTORY and FOAM_SCOPE explicitly');
  registerFoam(pi, new Foam({ directory: process.env.FOAM_DIRECTORY, scope: process.env.FOAM_SCOPE, inference: inferenceFromEnv() }));
}
