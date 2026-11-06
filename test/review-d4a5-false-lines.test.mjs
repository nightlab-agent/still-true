import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';

async function check(note) {
  const lines = [];
  const code = await run(['note.md', '--repo', 'a/b'], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => note,
    read: async () => ({ state: 'open', kind: 'pull', at: null, url: 'u' }),
    defaultRepo: null, token: null, env: {},
  });
  assert.equal(code, 0, lines.join('\n'));
}

const children = '\n  - #12 merged\n  - #13 merged';

test('control: Planned parent suppresses both children', async () => {
  await check('- Planned:' + children);
});

test('regression: To do parent suppresses both children', async () => {
  await check('- To do:' + children);
});

test('control: a separate comment retains planned scope', async () => {
  await check('- Planned:\n  <!-- x -->' + children);
});

test('pre-existing: a trailing comment retains planned scope', async () => {
  await check('- Planned: <!-- x -->' + children);
});
