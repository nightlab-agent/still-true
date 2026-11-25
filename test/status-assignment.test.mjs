import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';
import { readState } from '../src/github.mjs';

const facts = (note) => extractClaims(note).map(({ ref, said }) => [ref.number, said]);

// Labelled reference lists and inherited parenthetical states are existing handoff forms.
// Completing one subject's state must end its pending list before the next subject.
for (const [note, expected] of [
  ['Status: #12 (open), #13 merged', [[12, 'open'], [13, 'merged']]],
  ['Status: #12 (merged), #13 open', [[12, 'merged'], [13, 'open']]],
  ['Status: #12 (closed without merging), #13 open', [[12, 'closed'], [13, 'open']]],
  ['Status: #12 (title, open), #13 merged', [[12, 'open'], [13, 'merged']]],
  ['Status: #12 ((open)), #13 merged', [[12, 'open'], [13, 'merged']]],
  ['Checks: #12, #13 (open), #14 merged', [[12, 'open'], [13, 'open'], [14, 'merged']]],
]) test(`parenthetical status completes the subject list: ${note}`, () => {
  assert.deepEqual(facts(note), expected);
});

test('controls: title-only parentheses keep pending lists; explicit states keep independent subjects', () => {
  for (const [note, expected] of [
    ['Status: #12 (title), #13, open', [[12, 'open'], [13, 'open']]],
    ['Status: #12, #13 (title), open', [[12, 'open'], [13, 'open']]],
    ['Status: #12, open, #13 merged', [[12, 'open'], [13, 'merged']]],
    ['#12 (open), #13 merged', [[12, 'open'], [13, 'merged']]],
    ['Status: #12 (see #14), #13 open', [[13, 'open']]],
    ['Status: #12 (open, no longer true), #13 merged', [[13, 'merged']]],
    ['Status: #12 (not merged), #13 open', []],
  ]) assert.deepEqual(facts(note), expected, note);
});

test('title-only parentheses do not close a counted list', () => {
  assert.deepEqual(facts('2 open (#12 (title), #13 open), no longer true'), []);
  assert.deepEqual(facts('2 closed (#12 (title), #13, merged)').filter(([, said]) => said === 'merged'),
    [[12, 'merged'], [13, 'merged']]);
});

test('a retraction after completed parenthetical states takes back its own scope', () => {
  assert.deepEqual(facts('Status: #12 (open), #13 (open), no longer true'), [[12, 'open']]);
  assert.deepEqual(facts('Status: #12 (open), #13 (open); no longer true'), []);
});

test('a labelled mixed-state note gives correct verdicts through the real reader and comparator', async () => {
  for (const json of [false, true]) {
    for (const firstState of ['open', 'merged']) {
      const output = [], reads = [];
      const code = await run(['note.md', '--repo', 'a/b', '--strict', ...(json ? ['--json'] : [])], {
        out: (line) => output.push(line), extract: extractClaims,
        readFile: async () => 'Status: #12 (open), #13 merged', defaultRepo: null, env: {},
        read: (ref) => readState(ref, { fetchFn: async (url) => {
          reads.push(url);
          const merged = ref.number === 13 || firstState === 'merged';
          return new Response(JSON.stringify({ state: merged ? 'closed' : 'open',
            pull_request: { merged_at: merged ? '2026-11-07T12:00:00Z' : null },
            html_url: `https://github.com/a/b/pull/${ref.number}`,
          }), { status: 200 });
        } }),
      });
      assert.equal(code, firstState === 'open' ? 0 : 1, output.join('\n'));
      assert.deepEqual(reads, ['https://api.github.com/repos/a/b/issues/12', 'https://api.github.com/repos/a/b/issues/13']);
      if (json) {
        const report = JSON.parse(output[0]);
        assert.equal(report.complete, true);
        assert.deepEqual(report.claims.map(({ reference, said, actual, kind }) => [reference, said, actual, kind]), [
          ['a/b#12', 'open', firstState, firstState === 'open' ? 'ok' : 'contradiction'],
          ['a/b#13', 'merged', 'merged', 'ok'],
        ]);
        assert.deepEqual(report.counts, { checked: 2, contradicted: firstState === 'open' ? 0 : 1, looks: 0, notChecked: 0 });
      } else {
        assert.match(output.join('\n'), /2 claims checked/);
        assert.doesNotMatch(output.join('\n'), /said merged, but a\/b#12/);
      }
    }
  }
});
