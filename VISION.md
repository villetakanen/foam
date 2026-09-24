# FOAM

FOAM explores fleeting, partial memory that adds contextual awareness to an agent.
Experience leaves impressions; a later encounter can bring some of them back and
reshape them. Like memory foam, what came before can influence the present shape.

**Partial recollection is useful in its own right.** Remembering a connection can be
enough to find relevant material, recognize what someone might mean, or ask a better
question. Complete recall is welcome, but is not the objective.

## Inspiration from natural intelligence

Our research gives this experiment three starting points:

- **Recall depends on cues and context.** Memory for Goals models how associative cues
  help retrieve suspended goals amid interference ([Altmann & Trafton, 2002](https://www.interruptions.net/literature/Altmann-CogSci02.pdf)).
- **Remembering can involve reconstruction.** Structured Event Memory models recall
  using memory traces and learned event structure ([Franklin et al., 2020](https://pubmed.ncbi.nlm.nih.gov/32223284/)).
- **Recollection can participate in change.** Reminder-and-new-learning experiments
  show modification of later episodic recall ([Hupbach et al., 2007](https://pubmed.ncbi.nlm.nih.gov/17202429/)).

FOAM's hypothesis is that these ideas can inform useful, evolving contextual awareness
across agent sessions. This is an engineering interpretation, not a validated model of
natural memory. The research does not prescribe a forgetting timer or require every
read to change memory.

## What this could feel like

After clearing a coding session, the agent recalls that this epic relates to some
otherwise unobvious files—enough to consult them or ask you about the connection.

After discussing pool hours on Discord, you ask on WhatsApp, “What were the times
again?” The assistant asks, “Do you mean the swimming-pool opening hours?” That partial
recognition already helps the conversation continue.

The aim is useful awareness from what lingers. How impressions form, fade and return
remains something to explore. See the [spec](specs/memory/spec.md) for intended behavior
and current mechanics, and the [roadmap](ROADMAP.md) for unresolved work.
