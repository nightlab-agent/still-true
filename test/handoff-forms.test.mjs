import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';
import { readState } from '../src/github.mjs';

const reference = 'karanb192/awesome-claude-code-mods#427';
const url = 'https://github.com/karanb192/awesome-claude-code-mods/pull/427';
const forms = [
  'only karanb192/awesome-claude-code-mods#427 (merged 11-07, known)',
  'karanb192/awesome-claude-code-mods#427, merged 11-07',
  'Replies: LAST 2026-11-08T06:12Z; karanb192/awesome-claude-code-mods#427, merged 11-07',
  'karanb192/awesome-claude-code-mods#427 merged 11-07',
];

const invoke = async (text, json = true) => {
  const output = [];
  let reads = 0;
  const code = await run(['handoff.md', '--strict', ...(json ? ['--json'] : [])], {
    out: (line) => output.push(line), extract: extractClaims,
    readFile: async () => text, defaultRepo: null, env: {},
    read: (ref, options) => readState(ref, { ...options, fetchFn: async (request) => {
      reads++;
      assert.equal(request, 'https://api.github.com/repos/karanb192/awesome-claude-code-mods/issues/427');
      return new Response(JSON.stringify({
        state: 'closed', pull_request: { merged_at: '2026-11-07T12:00:00Z' }, html_url: url,
      }), { status: 200 });
    } }),
  });
  return { code, output: output.join('\n'), reads };
};

// s649's three reported forms and the already-readable bare-reference control.
for (const form of forms) test(`handoff merge fact: ${form}`, async () => {
  const note = `## Now\n\n${form}\n`;
  const result = await invoke(note);
  assert.equal(result.code, 0);
  assert.equal(result.reads, 1);
  const report = JSON.parse(result.output);
  assert.equal(report.complete, true);
  assert.deepEqual(report.counts, { checked: 1, contradicted: 0, looks: 0, notChecked: 0 });
  assert.deepEqual(report.claims, [{
    file: 'handoff.md', line: 3, reference, said: 'merged', actual: 'merged', kind: 'ok', url,
  }]);
  assert.equal('unread_references' in report, false);
  const plain = await invoke(note, false);
  assert.deepEqual(plain, { code: 0, output: '1 claim checked, 0 contradicted', reads: 1 });
});

test('handoff punctuation does not promote unrelated references or prose to subjects', () => {
  for (const text of [
    `see only ${reference} (merged 11-07, known)`,
    `I mentioned only ${reference}, merged 11-07`,
    `only a PR for issue ${reference} (merged 11-07, known)`,
    `${reference}, merged documentation`,
    `${reference}, see other/repo#428, merged 11-07`,
    `Replies: LAST 2026-11-08T06:12Z; see ${reference}, merged 11-07`,
  ]) assert.deepEqual(extractClaims(text), [], text);
});

test('handoff merge facts retain historical, quoted, conditional and retracted exclusions', () => {
  for (const form of forms) {
    for (const text of [
      `Old note: ${form}`, `Yesterday: ${form}`, `## History\n\n${form}`,
      `> ${form}`, `"${form}"`, `If CI passes, ${form}`, `${form} (no longer true)`,
    ]) assert.deepEqual(extractClaims(text), [], text);
  }
});
