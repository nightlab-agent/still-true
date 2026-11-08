import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';
import { readState } from '../src/github.mjs';

const repo = 'owner/example';
const url = `https://github.com/${repo}/pull/217`;
const forms = [
  '#217 is squash-merged',
  `[Index PR #217](${url}) is squash-merged as \`c0ffee1\`.`,
];

for (const form of forms) test(`squash merge claim: ${form}`, () => {
  assert.deepEqual(extractClaims(form), [{
    line: 1, ref: { number: 217 }, said: 'merged', quote: form,
  }]);
});

test('a leading subject link also accepts a simple link destination', () => {
  const form = '[Index PR #217](url) is squash-merged as `c0ffee1`.';
  assert.deepEqual(extractClaims(form), [{
    line: 1, ref: { number: 217 }, said: 'merged', quote: form,
  }]);
});

test('squash merge claims retain retractions, qualifiers and Markdown exclusions', () => {
  for (const original of forms) {
    const form = original.replace(/\.$/, '');
    for (const text of [
      `${form} (no longer true)`, `${form}, not true`, `${form}; no longer true`,
      `${form}, maybe once CI passes`, `${form} if CI passes`, `${form}\n  if CI passes`,
      `${form}, not squash-merged`, `${form}, squash-merged or open`,
      `${form}, open or squash-merged`,
      `If CI passes, ${form}`, `Old note: ${form}`, `## History\n\n${form}`,
      `> ${form}`, `"${form}"`, `\`${form}\``, `see ${form}`,
    ]) assert.deepEqual(extractClaims(text), [], text);
  }
  for (const original of forms) {
    const form = original.replace(/\.$/, '');
    assert.deepEqual(extractClaims(`${form}; no longer true, #218 is merged`).map((c) => c.ref.number), [218]);
  }
});

test('squash merge normalization does not invent compound states or link subjects', () => {
  for (const text of [
    '#217 is unsquash-merged', '#217 is re-squash-merged', '#217 is squash-merged-locally',
    '#217 is squash-open', '#217 is not squash-merged',
    'owner/[repo#217](url) is squash-merged', '[#217](url)open',
    '[a PR for issue #217](url) is squash-merged',
    '[Example PR #217](url) is squash-merged',
  ]) assert.deepEqual(extractClaims(text), [], text);
  assert.equal(extractClaims('#217 is merged')[0].said, 'merged');
  assert.deepEqual(extractClaims('owner/squash-merged#217 is open')[0].ref,
    { owner: 'owner', repo: 'squash-merged', number: 217 });
});

const invoke = async (text, state = 'merged', json = true) => {
  const output = [], requests = [];
  const code = await run(['note.md', '--repo', repo, '--strict', ...(json ? ['--json'] : [])], {
    out: (line) => output.push(line), extract: extractClaims,
    readFile: async () => text, env: {},
    read: (ref, options) => readState(ref, { ...options, fetchFn: async (request) => {
      requests.push(request);
      return new Response(JSON.stringify({
        state: state === 'merged' ? 'closed' : state,
        pull_request: { merged_at: state === 'merged' ? '2026-10-11T15:30:16Z' : null },
        html_url: url,
      }), { status: 200 });
    } }),
  });
  return { code, output: output.join('\n'), requests };
};

test('shape-preserving note checks the merge and leaves the distant draft claim unread', async () => {
  const note = await readFile(new URL('./fixtures/real-shape/squash-note/note.md', import.meta.url), 'utf8');
  const result = await invoke(note);
  assert.equal(result.code, 0);
  assert.deepEqual(result.requests, [`https://api.github.com/repos/${repo}/issues/217`]);
  const report = JSON.parse(result.output);
  assert.equal(report.complete, true);
  assert.deepEqual(report.counts, { checked: 1, contradicted: 0, looks: 0, notChecked: 0 });
  assert.deepEqual(report.claims, [{
    file: 'note.md', line: 1, reference: `${repo}#217`, said: 'merged',
    actual: 'merged', kind: 'ok', url,
  }]);
  assert.deepEqual(report.unread_references, [{ file: 'note.md', line: 3, reference: `${repo}#218` }]);
  assert.deepEqual(await invoke(note, 'merged', false), {
    code: 0, requests: result.requests,
    output: 'note.md:3  no claim read: #218\n1 claim checked, 0 contradicted, 1 reference with no claim read',
  });
});

test('a squash merge claim contradicts an open PR through the reader and CLI', async () => {
  for (const form of forms) {
    const result = await invoke(form, 'open');
    assert.equal(result.code, 1);
    const report = JSON.parse(result.output);
    assert.deepEqual(report.counts, { checked: 1, contradicted: 1, looks: 0, notChecked: 0 });
    assert.equal(report.claims[0].kind, 'contradiction');
    assert.equal(report.claims[0].said, 'merged');
    assert.equal(report.claims[0].actual, 'open');
  }
});

test('squash merge reads repeat and overlap without sharing results', async () => {
  const first = await invoke(forms[1]);
  assert.deepEqual(await invoke(forms[1]), first);
  const [merged, open] = await Promise.all([invoke(forms[1]), invoke(forms[1], 'open')]);
  assert.deepEqual(merged, first);
  assert.equal(merged.code, 0);
  assert.equal(open.code, 1);
});
