import type { InferenceAdapter } from '../dist/index.js';

/** A scripted test double, NOT a cognitive model or production memory policy. */
export const fixtureInference: InferenceAdapter = {
  async infer(input) {
    let markdown = input.memory.markdown;
    const experience = [input.encounter.cue, ...('observations' in input.encounter ? input.encounter.observations : [])].join('\n');
    if (experience.includes('repair is complete')) {
      markdown = markdown.replace(/## Repair[^]*?(?=\n## |$)/, '').trim();
      markdown += '\n## Repair\nThe repair is complete. The old booking intention is no longer current.\n';
    } else if (experience.includes('sink is leaking') && !markdown.includes('## Repair')) {
      markdown += '\n## Repair\nThe sink is leaking. Alex is waiting for the plumber appointment.\n';
    }
    if (experience.includes('plan a train trip') && !markdown.includes('## Travel')) {
      markdown += '\n## Travel\nAlex is planning a train trip. Dates remain undecided.\n';
    }
    let context = '';
    if (/repair|sink|plumber/.test(input.encounter.cue)) context = markdown.match(/## Repair[^]*?(?=\n## |$)/)?.[0]?.trim() ?? '';
    else if (/trip|train/.test(input.encounter.cue)) context = markdown.match(/## Travel[^]*?(?=\n## |$)/)?.[0]?.trim() ?? '';
    return { markdown, context };
  },
};
export const cues = [
  'The sink is leaking; Alex is waiting for the plumber appointment.',
  'Interrupt that: plan a train trip.',
  'Back to the sink repair: what were we waiting for?',
  'The repair is complete; the plumber fixed the sink.',
  'That old plumber reminder appeared again. What is the situation?',
  'That old plumber reminder appeared again. What is the situation?',
];
