import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';

const unreadOf = (text) => {
  const unread = [];
  extractClaims(text, { unread });
  return unread;
};

test('the first independent list item after a quote keeps its unread reference', () => {
  // Passing neighbour: a blank line separates the same quote and list.
  assert.deepEqual(unreadOf('> quote\n\n- see #12'), [{ line: 3, ref: { number: 12 } }]);
  assert.deepEqual(unreadOf('> quote\n- see #12'), [{ line: 2, ref: { number: 12 } }]);
});

test('a skipped setext heading is not an unread reference in the note body', () => {
  // Passing neighbour: the same skipped heading in ATX form.
  assert.deepEqual(unreadOf('## History #12\n\nsee #13'), []);
  assert.deepEqual(unreadOf('History #12\n---\n\nsee #13'), []);
});

const invoke = async (text, ...flags) => {
  const lines = [];
  const code = await run(['h.md', '--repo', 'a/b', ...flags], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => text,
    read: async () => ({ state: 'open', kind: 'pull', at: null, url: 'u' }),
    defaultRepo: null, env: {},
  });
  return { code, lines };
};

// Dex's proposed strict policy, held for the next version: the print half ships first.
test.todo('next version: strict fails a missed explicit assertion, preserving bare refs and contradiction priority', async () => {
  const bare = 'see #1. #2 open';
  const conditional = '#1 open until CI passes. #2 open';
  const until = 'PRs: #1 open, no new one until a slot frees. #2 open';
  const missed = '#1 has been merged. #2 open';

  // These controls pass today. A status word alone is not an assertion.
  assert.equal((await invoke(bare, '--strict')).code, 0);
  assert.equal((await invoke(conditional, '--strict')).code, 0);
  assert.equal((await invoke(until)).code, 0);
  assert.equal((await invoke(missed)).code, 0);
  assert.equal((await invoke(`${missed}\n\n#3 merged`, '--strict')).code, 1);

  // Both assertions were dropped; #2 still verified, so the existing empty-note rule cannot help.
  for (const text of [until, missed]) {
    const result = await invoke(text, '--strict');
    assert.match(result.lines.join('\n'), /no claim read: #1/);
    assert.match(result.lines.join('\n'), /1 claim checked, 0 contradicted/);
  }
  assert.deepEqual(await Promise.all([until, missed].map(async (text) =>
    (await invoke(text, '--strict')).code)), [3, 3]);
});
