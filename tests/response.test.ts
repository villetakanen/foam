import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Foam, decodeInterpretation, jsonInference } from '../src/index.js';
import type { InferenceInput } from '../src/index.js';

const valid = '{"markdown":"Radiator width 620 mm","context":"Radiator"}';
const invalid = ['Commentary\n' + valid, valid + '\nCommentary', '```js\n' + valid + '\n```',
  '```json\n' + valid, '```json\n' + valid + '\n```\n```\n{}\n```', '{', '{}', '[]', 'null',
  '{"markdown":1,"context":""}', '{"markdown":"","context":"","extra":true}', 'x'.repeat(262145)];

test('bounded envelope decoder accepts only plain or single complete JSON fences', () => {
  for (const raw of [valid, ` \n${valid}\t`, `\n\`\`\`json\n${valid}\n\`\`\`\n`, `\`\`\`\r\n${valid}\r\n\`\`\``]) {
    assert.deepEqual(decodeInterpretation(raw).interpretation, JSON.parse(valid));
    assert.equal(decodeInterpretation(raw).normalized, raw.includes('```'));
  }
  for (const raw of invalid) assert.throws(() => decodeInterpretation(raw));
  assert.throws(() => decodeInterpretation(valid, 1));
});

test('HTTP and embedded decoders reject all envelope/schema failures without changing memory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'foam-decoder-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let raw = valid;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: raw } }] }));
  const adapters = [jsonInference({ endpoint: 'http://localhost:1', model: 'fixture' }), {
    async infer(_input: InferenceInput, _signal: AbortSignal, report?: (value: { normalized: boolean }) => void) {
      const decoded = decodeInterpretation(raw); report?.({ normalized: decoded.normalized }); return decoded.interpretation;
    },
  }];
  for (const [index, inference] of adapters.entries()) {
    const records: any[] = [];
    const foam = new Foam({ directory: join(directory, String(index)), scope: 'test', inference, diagnostics: record => { records.push(record); } });
    raw = valid;
    const first = await foam.prepare({ cue: 'radiator', occurrence: 'plain' });
    raw = `\`\`\`json\n${valid}\n\`\`\``;
    const second = await foam.prepare({ cue: 'radiator', occurrence: 'fenced' });
    assert.equal(first.markdown, second.markdown);
    assert.equal(records.at(-1).normalized, true);
    const bytes = await readFile(join(foam.directory, 'memory.md'));
    for (raw of invalid) {
      await assert.rejects(foam.prepare({ cue: 'radiator', occurrence: 'invalid' }));
      assert.deepEqual(await readFile(join(foam.directory, 'memory.md')), bytes);
      assert.equal(records.at(-1).outcome, 'failed');
    }
  }
});
