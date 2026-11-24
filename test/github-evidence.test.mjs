import test from 'node:test';
import assert from 'node:assert/strict';
import { readState } from '../src/github.mjs';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';

const ref = { owner: 'a', repo: 'b', number: 1 };
const response = (pull_request, state = 'closed') => new Response(JSON.stringify({
  state, pull_request, html_url: 'https://github.com/a/b/pull/1',
}), { status: 200 });

for (const merged of [undefined, false, 0, '', {}, [], true, 'not a timestamp']) {
  test(`a closed PR with unavailable merge evidence fails the read: ${JSON.stringify(merged)}`, async () => {
    await assert.rejects(readState(ref, { fetchFn: async () => response({ merged_at: merged }) }),
      /GitHub gave no merge state for a\/b#1/);
  });
}

for (const [merged, state] of [[null, 'closed'], ['2026-11-05T19:19:00Z', 'merged']]) {
  test(`a closed PR with explicit merge evidence still reads ${state}`, async () => {
    const result = await readState(ref, { fetchFn: async () => response({ merged_at: merged }) });
    assert.equal(result.state, state);
  });
}
test('an open PR needs no merge time to establish that it is open', async () => {
  const result = await readState(ref, { fetchFn: async () => response({}, 'open') });
  assert.equal(result.state, 'open');
});

for (const strict of [false, true]) for (const earlierContradiction of [false, true]) {
  test(`incomplete merge evidence preserves unresolved claims and exit priority (strict=${strict}, contradiction=${earlierContradiction})`, async () => {
    const output = [], reads = [];
    const code = await run(['note.md', '--repo', 'a/b', '--json', ...(strict ? ['--strict'] : [])], {
      out: (line) => output.push(line), extract: extractClaims, env: {},
      readFile: async () => '- #1 open\n- #2 merged\n- #3 open\n',
      read: (reference) => readState(reference, { fetchFn: async () => {
        reads.push(reference.number);
        return reference.number === 1
          ? response({ merged_at: earlierContradiction ? '2026-11-05T19:19:00Z' : null }, earlierContradiction ? 'closed' : 'open')
          : response({});
      } }),
    });
    assert.equal(code, earlierContradiction ? 1 : 2);
    assert.equal(output.length, 1);
    const report = JSON.parse(output[0]);
    assert.equal(report.complete, false);
    assert.match(report.reason, /GitHub gave no merge state for a\/b#2/);
    assert.deepEqual(report.counts, { checked: 1, contradicted: Number(earlierContradiction), looks: 0, notChecked: 2 });
    assert.deepEqual(report.claims.map(({ kind, actual }) => ({ kind, actual })), [
      { kind: earlierContradiction ? 'contradiction' : 'ok', actual: earlierContradiction ? 'merged' : 'open' },
      { kind: 'not checked', actual: null },
      { kind: 'not checked', actual: null },
    ]);
    assert.deepEqual(reads, [1, 2]);
  });
}
