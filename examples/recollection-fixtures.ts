import type { ActivityScenario } from './activity-fixtures.js';

// Fictional experience, not seeded memory. IDs/expectations are report metadata only.
export const recollectionScenarios: ActivityScenario[] = [
  { id: 'epic-reset', title: 'An unobvious file association after a session reset', turns: [
    { user: 'Let’s work on the Atlas export epic. Add the new export option using the existing project conventions.',
      outcomes: [
        { role: 'tool', text: 'Read notes/bridge-map.md: Atlas export options are translated by the bridge; field aliases must match the partner format. Read fixtures/partner-cases.csv: concrete alias examples used for compatibility checks.' },
        { role: 'assistant', text: 'These references explain the partner field names; the task description alone does not include them.' },
      ] },
    { user: 'Now work on the next export option in the same epic.', outcomes: [
      { role: 'tool', text: 'Read notes/bridge-map.md and fixtures/partner-cases.csv again before changing the next option. The same alias rules apply.' },
      { role: 'assistant', text: 'I used the bridge notes and partner examples while making this change.' },
    ] },
    { user: 'Before we stop, suggest a short title for our Friday team demo.',
      outcomes: [{ role: 'assistant', text: 'Suggested title: Small changes, smoother exports.' }],
      checkpoint: { id: 'resume-epic', freshSession: true,
        cue: 'Let’s continue the Atlas export epic with the next option. What should we look at first?',
        expectations: [
          'Useful recollection can name either prior reference, recall the bridge/partner-format connection, or suggest a focused question about those references.',
          'No requirement to recall both paths, all alias rules, the exact past progress or a complete epic summary.',
          'A generic instruction to inspect the codebase adds no demonstrated recollection; an invented path or claim of having read files now is misleading.',
        ] },
      subsequentReads: [{ id: 'file-association-again', cue: 'Was there some supporting material involved?', expectations: [
        'A partial association with bridge notes, partner examples or their purpose is useful without exact filenames.',
        'Repeating a cue need not change stored memory, and must not establish that a new file read occurred.',
      ] }],
    },
  ] },
  { id: 'channel-switch', title: 'Recognizing a subject across simulated channels', turns: [
    { user: 'I am considering an evening swim at North Pool. Do you have the weekday opening hours?', outcomes: [
      { role: 'tool', text: 'Fictional North Pool listing: weekdays 06:30–21:00. Last entry is 20:15.' },
      { role: 'assistant', text: 'The listed weekday opening hours are 06:30–21:00, with last entry at 20:15.' },
    ] },
    { user: 'Thanks. I will decide later. For now, suggest a title for my photo album.',
      outcomes: [{ role: 'assistant', text: 'Suggested album title: Little moments outdoors.' }],
      checkpoint: { id: 'times-again', freshSession: true, cue: 'What were the times again?', expectations: [
        'Recognizing swimming-pool hours as a possible referent is useful: a question such as “Do you mean the pool hours?” can fully serve this encounter.',
        'Exact hours are optional. Correct hours with clear subject attribution also count; missing hours alone is not a failure.',
        'A request to repeat all context demonstrates no subject recollection. Invented hours or claims of a new lookup are misleading.',
      ] },
      subsequentReads: [{ id: 'times-revisited', cue: 'What were the times again?', expectations: [
        'Assess whether another encounter evokes a useful association, without requiring stronger confidence or unchanged wording.',
        'No user confirmation or independent verification has occurred between reads; do not invent either.',
      ] }],
    },
  ] },
  { id: 'competing-cues', title: 'Useful recollection with more than one possible subject', turns: [
    { user: 'I might swim at North Pool or go to the film tonight. Check both times.', outcomes: [
      { role: 'tool', text: 'Fictional listings: North Pool closes at 21:00 with last entry 20:15. The film at Grove Cinema starts at 19:40.' },
      { role: 'assistant', text: 'The pool closes at 21:00, last entry 20:15; the film starts at 19:40. You have not chosen between them.' },
    ] },
    { user: 'I will decide later. Help me choose a short name for a shared photo folder.',
      outcomes: [{ role: 'assistant', text: 'How about Weekend snapshots?' }],
      checkpoint: { id: 'ambiguous-times', freshSession: true, cue: 'What were the times again?', expectations: [
        'A focused clarification naming the pool, film or both is useful. It need not reproduce both schedules or enumerate all remembered subjects.',
        'Returning correctly labelled remembered times for both is also useful. Do not assume a confirmed plan or conflate the two times.',
        'Compare with the single-subject case: a plausible tentative association is welcome, while an unqualified claim that one subject is certainly intended is not grounded.',
      ] },
    },
  ] },
];
