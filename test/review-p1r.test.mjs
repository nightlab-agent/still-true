// Release-review evidence: each false line has a passing comparison case.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';

async function check(text, state = 'open') {
  const lines = [];
  const code = await run(['note.md', '--repo', 'org/repo'], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => text,
    read: async () => ({ state, kind: 'pull', at: null, url: 'u' }),
    defaultRepo: null, token: null, env: {},
  });
  return { code, lines, alerts: lines.filter((line) => /said .*but|look:/.test(line)) };
}

test('F1 control: once at the start of a comma field stays conditional', async () => {
  assert.deepEqual((await check('#1 merged, once CI passes')).alerts, []);
});

test('F1: maybe once in a later field is still uncertainty', async () => {
  const result = await check('#1 merged, maybe once CI passes');
  assert.deepEqual(result.alerts, [], result.lines.join('\n'));
});

test('F2 control: an Old note label suppresses its historical list', async () => {
  assert.deepEqual((await check('Old note:\n- #1 open', 'merged')).alerts, []);
});

test('F2: a blockquote does not erase an Old note label', async () => {
  const result = await check('Old note:\n> context\n- #1 open', 'merged');
  assert.deepEqual(result.alerts, [], result.lines.join('\n'));
});

test('F2: queued work under the same historical label stays quiet too', async () => {
  const result = await check('Old note:\n> context\n- #1 owes a review', 'merged');
  assert.deepEqual(result.alerts, [], result.lines.join('\n'));
});

test('F3 control: an actual wait on a reference and a slot prints a look', async () => {
  const result = await check('Waiting on #1 and a slot.', 'merged');
  assert.equal(result.code, 0);
  assert.equal(result.alerts.length, 1);
  assert.match(result.alerts[0], /look: waits on org\/repo#1/);
});

test('F3: an unnecessary wait is not a current wait', async () => {
  const result = await check('Waiting on #1 and a slot is no longer necessary.', 'merged');
  assert.deepEqual(result.alerts, [], result.lines.join('\n'));
});
