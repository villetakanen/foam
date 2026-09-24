import type { ExchangeMessage } from '../dist/index.js';

export interface ActivityCheckpoint {
  id: string;
  cue: string;
  /** Reviewer-only material. Never sent to either memory system or responding client. */
  expectations: string[];
  /** Simulate a fresh host session: reopen persisted memory and remove transcript context. */
  freshSession?: boolean;
}
export interface ActivityTurn {
  user: string;
  outcomes: ExchangeMessage[];
  checkpoint?: ActivityCheckpoint;
  /** Successive read encounters; each sees memory committed by the preceding read. */
  subsequentReads?: ActivityCheckpoint[];
}
export interface ActivityScenario {
  id: string;
  title: string;
  turns: ActivityTurn[];
}
const assistant = (text: string): ExchangeMessage => ({ role: 'assistant', text });
const tool = (text: string): ExchangeMessage => ({ role: 'tool', text });

// Fictional, continuous transcripts. Expected interpretations are separate from experience.
export const activityScenarios: ActivityScenario[] = [
  {
    id: 'unfolding', title: 'Following an unfolding workshop plan', turns: [
      { user: 'Help me plan a small data workshop for our volunteer group. Most people are beginners. I want them to leave having tried something, not just watched slides.',
        outcomes: [assistant('We can build the session around one practical exercise. I will compare accessible venues and then we can choose an activity that fits the room.')] },
      { user: 'We expect about twelve people. Keep the room cost under 100 euros and make sure nobody has to use stairs.',
        outcomes: [tool('Venue lookup: Tide Room costs 80 euros and has step-free access. Loft Room costs 70 euros and is upstairs without a lift. Both have a projector.'),
          assistant('Tide Room meets the cost and access constraints. I would use it if the exercise facilities suit us.')],
        checkpoint: { id: 'venue-options', cue: 'Where have we got to with the workshop plan?', expectations: [
          'A beginner-friendly, hands-on workshop for about twelve volunteers is the goal.',
          'Tide is the suitable candidate because it meets both budget and access requirements; it has not been booked.',
          'The exercise and facilities still need to be worked out, rather than treating the plan as finished.',
        ] } },
      { user: 'Tide sounds right. Check whether we can rely on its internet before we settle on the exercise.',
        outcomes: [tool('Tide venue response: projector available; guest internet is unreliable. No booking has been placed.'),
          assistant('An exercise using a prepared local dataset would avoid depending on the connection.')] },
      { user: 'Agreed: use Tide and an offline exercise with our sample survey. Next I want to work out how to pair beginners with the more experienced volunteers. We still do not know who will attend.',
        outcomes: [assistant('We have a room choice and an offline format. Pairing depends on who signs up; the next discussion is how to organise that without assuming an attendance list.')],
        checkpoint: { id: 'current-plan', cue: 'Let’s continue organising the workshop.', expectations: [
          'Tide is chosen, not confirmed booked; the offline sample-survey exercise follows from unreliable internet.',
          'Current attention is on pairing beginners with experienced volunteers; attendance is still unknown.',
          'Preserve the beginner-friendly practical purpose without presenting earlier venue selection as still undecided.',
        ] },
        subsequentReads: [
          { id: 'offline-reason', cue: 'Remind me why we chose an offline exercise.', expectations: [
            'Recover the unreliable guest internet at Tide as the reason for the offline exercise.',
            'Keep the chosen room, hands-on purpose and unresolved pairing situation available in memory.',
            'The question is a change of attention, not evidence of a new venue decision or completed booking.',
          ] },
          { id: 'return-pairing', cue: 'Back to pairing the volunteers. Where are we with that?', expectations: [
            'Return to pairing beginners with experienced volunteers while attendance is still unknown.',
            'Preserve the chosen Tide venue and offline sample-survey exercise without reopening settled choices.',
            'Reading about the offline rationale did not supply attendance, approve a pairing scheme or complete the work.',
          ] },
        ] },
    ],
  },
  {
    id: 'resumption', title: 'Resuming export work after a deployment interruption', turns: [
      { user: 'The reporting app freezes during large CSV exports. Help me investigate without changing the exported columns.',
        outcomes: [tool('Profile: the browser builds the entire CSV string in memory before download. The query completes normally.'),
          assistant('The evidence points to CSV construction in the browser, rather than the database query. I will try incremental output while retaining the column format.')] },
      { user: 'Try that approach and check whether it really preserves the output.',
        outcomes: [tool('Incremental export patch applied. Large export completes in Chromium; fixture comparison shows identical columns and rows. Safari has not been tested.'),
          assistant('The Chromium result supports the approach. Safari compatibility remains unverified; I have not marked the export work complete.')] },
      { user: 'Pause the export work. Staging has started returning 502 errors after the latest deployment.',
        outcomes: [tool('Staging health check: upstream port configured as 8080; the new service listens on 8081. Database migrations are unchanged.'),
          assistant('The port mismatch explains the failed upstream connection. I will correct staging routing rather than alter the export patch.')] },
      { user: 'Correct the staging port and check health.',
        outcomes: [tool('Staging proxy changed to 8081. Health endpoint and login smoke test pass.'),
          assistant('Staging is responding again. These checks cover staging recovery, not production rollout.')],
        checkpoint: { id: 'return-export', cue: 'Back to the large CSV export. Let’s pick up where we stopped.', expectations: [
          'Resume the browser-side export work, keeping columns unchanged; the database was not the bottleneck.',
          'Incremental output already passed Chromium and output comparison; do not restart that investigation as if untried.',
          'Safari is the remaining unverified part. Staging port details should not become export requirements.',
        ] } },
      { user: 'Back to the large CSV export. Check Safari using the same output fixture.',
        outcomes: [tool('Safari export completes; CSV fixture comparison passes. No change to exported columns.'),
          assistant('The export approach now passes the tested Chromium and Safari cases. The earlier staging repair is a separate change.')] },
      { user: 'Prepare a short export-change description for review; do not deploy it yet.',
        outcomes: [assistant('Draft: build large CSV exports incrementally to avoid browser freezes while preserving the existing columns and rows. Chromium and Safari fixture checks pass. Ready for review, not deployed.')],
        checkpoint: { id: 'return-staging', cue: 'And where did we leave the staging outage?', expectations: [
          'Recall the staging port mismatch and the successful health/login checks; do not report an ongoing outage.',
          'Do not conflate the export patch, its review state or its browser checks with the staging repair.',
          'Retain the export work in stored memory while focusing this response on staging.',
        ] } },
    ],
  },
  {
    id: 'revision', title: 'Revising an import diagnosis as evidence changes', turns: [
      { user: 'Some uploaded CSV files lose a row in preview. Could the parser be mishandling quoted commas?',
        outcomes: [assistant('That is a hypothesis. I will first reproduce the problem and compare a valid quoted field with a failing upload.')] },
      { user: 'Use the customer-shaped fixture, with fictional data, and check the actual bytes.',
        outcomes: [tool('A valid quoted-comma fixture parses correctly. The failing fixture has an unmatched quote in its final row; the current importer silently skips that malformed row.'),
          assistant('The quoted-comma hypothesis is not supported by this result. The observed problem is malformed input being silently skipped.')],
        checkpoint: { id: 'changed-diagnosis', cue: 'What does that result mean for our approach?', expectations: [
          'Quoted commas were a hypothesis, not an established parser defect, and their valid fixture passes.',
          'The evidence is an unmatched quote plus silent row skipping; explain that change in understanding.',
          'A different implementation direction can be proposed, but do not claim a fix has already been made.',
        ] } },
      { user: 'Leave parsing of valid files alone. Reject malformed uploads before preview and show which row needs attention.',
        outcomes: [tool('Validation added before preview. Valid quoted-comma fixture still passes. Malformed fixture is rejected with a row number; no rows are imported.'),
          assistant('Validation addresses the silent failure without changing valid-file parsing. We can now work on the user-facing explanation.')] },
      { user: 'The error currently just says “invalid CSV”. Let’s explain the unmatched quote and suggest checking the exported file. I want to review that wording before we call this done.',
        outcomes: [assistant('Draft wording: “We could not read row 18 because a quoted field is not closed. Check that row in the exported file and upload it again.” This is a draft for your review, not approved text.')],
        checkpoint: { id: 'current-understanding', cue: 'Let’s continue the import work.', expectations: [
          'Current work is reviewing the error wording; validation is implemented and the stated fixture checks pass.',
          'Valid-file parsing was deliberately left unchanged because the quoted-comma fixture worked.',
          'The wording is a proposal awaiting review. Do not revive parser replacement or declare the whole activity finished.',
        ] } },
    ],
  },
  {
    id: 'dispatch-reason', title: 'Retaining the reason for a dispatch decision', turns: [
      { user: 'Help organise delivery of our exhibit panels. We want visitors to find the exhibition easy to navigate.',
        outcomes: [tool('Supplier: panels need 48 hours flat after delivery before they can be mounted. The installation crew arrives Thursday morning.'),
          assistant('Delivery needs to leave enough time before installation for the panels to rest.')] },
      { user: 'Choose Monday delivery so the panels have the full resting time before Thursday. We can work on the visitor labels next.',
        outcomes: [assistant('Monday is the chosen delivery day. The supplier still needs to confirm the slot. Label drafting is next.')] },
      { user: 'Use short labels with the exhibit name and one sentence. We have not agreed their order yet.',
        outcomes: [assistant('The label format is agreed; the next decision is their order along the route.')],
        checkpoint: { id: 'dispatch-rationale', cue: 'Why did we pick Monday for delivery?', expectations: [
          'Monday was chosen to allow the panels 48 hours flat before the Thursday installation.',
          'Easy visitor navigation is the overall goal, not the established reason for the delivery day.',
          'Delivery is chosen but not confirmed by the supplier; label ordering remains open.',
        ] },
        subsequentReads: [{ id: 'return-labels', cue: 'Back to the labels. What remains to decide?', expectations: [
          'Short exhibit-name-and-sentence format is agreed; ordering along the route is unresolved.',
          'Retain the delivery choice and its resting-time reason while attention returns to labels.',
          'Do not invent a confirmed slot or an agreed label order.',
        ] }],
      },
    ],
  },
  {
    id: 'unknown-reason', title: 'Leaving an unrecorded choice rationale unknown', turns: [
      { user: 'Help prepare a small neighbourhood oral-history listening event. The aim is to make the recordings approachable for first-time visitors.',
        outcomes: [assistant('We can plan the listening order and short introductions.')] },
      { user: 'Use the Birch room. That choice was made before this conversation; I do not have the reason recorded here. Now work on introductions.',
        outcomes: [assistant('Birch is the chosen room. Its selection rationale is unavailable in this conversation.')] },
      { user: 'Keep each introduction under a minute. The sequence of recordings is still undecided.',
        outcomes: [assistant('Introductions should be under a minute; the recording sequence remains to be decided.')],
        checkpoint: { id: 'unknown-room-rationale', cue: 'Why did we choose Birch?', expectations: [
          'The choice is known but its rationale is not available; say so without guessing.',
          'Do not turn the approachable-listening goal into a claimed room-selection reason.',
          'No accessibility, acoustics, cost or capacity evidence was supplied for Birch.',
        ] },
        subsequentReads: [{ id: 'unknown-reason-revisit', cue: 'Before we continue, remind me of the reason for Birch again.', expectations: [
          'Repeated access provides no new evidence: the selection rationale remains unknown.',
          'Retain the known room choice and open recording sequence without promoting speculation into history.',
        ] }],
      },
    ],
  },
];
