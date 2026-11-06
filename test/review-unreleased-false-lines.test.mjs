import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';

async function check(note, state = 'open') {
  const lines = [];
  await run(['note.md', '--repo', 'a/b'], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => note,
    read: async () => ({ state, kind: 'pull', at: null, url: 'u' }),
    defaultRepo: null, token: null, env: {},
  });
  assert.deepEqual(lines.filter((line) => /said .*but|look:/.test(line)), []);
}

test('F1 control: once at the start of a comma field remains conditional', async () => {
  await check('#1 merged, once CI passes.');
});

test('F1a: only once after a comma still qualifies the preceding state', async () => {
  await check('#1 merged, only once CI passes.');
});

test('F1b: a later conditional state is not a current fact', async () => {
  await check('#1 open, #2 merged once CI passes.');
});

test('F2 control: a historical label covers the following item', async () => {
  await check('Old note:\n- #1 open', 'merged');
});

test('F2: a comment-only line retains historical scope', async () => {
  await check('Old note:\n<!-- x -->\n- #1 open', 'merged');
});
