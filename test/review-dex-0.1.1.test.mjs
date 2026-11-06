// Dex's review of the 0.1.1 patch, each case beside its control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';

const merged = { state: 'merged', kind: 'pull', at: null, url: 'u' };
const open = { state: 'open', kind: 'pull', at: null, url: 'u' };
async function go(text, real = merged) {
  const lines = [];
  const code = await run(['note.md', '--repo', 'a/b'], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => text, read: async () => real,
    defaultRepo: null, env: {},
  });
  return { code, text: lines.join('\n') };
}

test('B1 control: a closed multi-line quote without a heading stays silent', async () => {
  const r = await go('They wrote "\nNow\n#12 open\n\n"');
  assert.equal(r.code, 0, r.text);
});
test('B1: a closed multi-line quote containing a heading stays silent', async () => {
  const r = await go('They wrote "\n## Now\n#12 open\n\n"');
  assert.equal(r.code, 0, r.text);
});

test('B2 control: a current parent retains the second nested assertion', () => {
  const claims = extractClaims('- Current merged PRs:\n  - #12 merged\n  - #13 merged');
  assert.ok(claims.some((c) => c.ref.number === 13 && c.said === 'merged'));
});
test('B2: a factual merged-PR parent retains the second nested assertion', async () => {
  // Assert the second child: the base already lost the first (N1 below).
  const r = await go('- Merged PRs:\n  - #12 merged\n  - #13 merged', open);
  assert.equal(r.code, 1, r.text);
});

test('B3 control: a positive wait after a negated wait survives a semicolon', async () => {
  const r = await go('Not waiting on #12; waiting on #13.');
  assert.match(r.text, /look: waits on a\/b#13/, r.text);
  assert.doesNotMatch(r.text, /look: waits on a\/b#12/, r.text);
});
test('B3: a positive wait after a negated wait survives a comma', async () => {
  const r = await go('Not waiting on #12, waiting on #13.');
  assert.match(r.text, /look: waits on a\/b#13/, r.text);
});

test('N1 control: a current parent separated by a blank keeps its assertion', () => {
  assert.equal(extractClaims('- Status:\n\n  - #12 merged').length, 1);
});
test('N1: a current parent immediately followed by its child keeps its assertion', () => {
  assert.equal(extractClaims('- Status:\n  - #12 merged').length, 1);
});

test('N2 control: a tight planned list stays silent', async () => {
  const r = await go('- Planned:\n  - #12 merged', open);
  assert.equal(r.code, 0, r.text);
});
test('N2: a loose planned list stays silent', async () => {
  const r = await go('- Planned:\n\n  - #12 merged', open);
  assert.equal(r.code, 0, r.text);
});

test('N3 control: a rule immediately after a list retains the next claim', () => {
  const claims = extractClaims('## Now\n\n- item\n---\n\n#13 open');
  assert.ok(claims.some((c) => c.ref.number === 13));
});
test('N3: a rule after a list continuation retains the next claim', () => {
  const claims = extractClaims('## Now\n\n- item\n  continuation\n---\n\n#13 open');
  assert.ok(claims.some((c) => c.ref.number === 13));
});

test('N4 control: a stray quote cannot bypass an ATX History heading', async () => {
  const r = await go('They wrote "ship it\n\n## History\n\nThey wrote ship"\n\n#12 open');
  assert.equal(r.code, 0, r.text);
});
test('N4: a stray quote cannot bypass a setext History heading', async () => {
  const r = await go('They wrote "ship it\n\nHistory\n-------\n\nThey wrote ship"\n\n#12 open');
  assert.equal(r.code, 0, r.text);
});

test('positive state facts survive negated waits in either comma order', async () => {
  for (const text of ['#13 merged, not waiting on #12.', 'No longer waiting on #12, #13 merged.']) {
    assert.deepEqual(extractClaims(text).map((c) => [c.ref.number, c.said]), [[13, 'merged']], text);
    assert.equal((await go(text, open)).code, 1, text);
  }
});
test('only the first level 1 heading is exempt, including setext titles', () => {
  for (const title of ['# Project', 'Project\n=======']) {
    const text = `${title}\n\n## Now\n\n#12 open\n\n# History\n\n## Now\n\n#13 open`;
    assert.deepEqual(extractClaims(text).map((c) => c.ref.number), [12], title);
  }
  assert.equal(extractClaims('## History\n\n# Project\n\n## Now\n\n#12 open').length, 1);
});
test('a colon parent carrying a claim retains all nested claims', () => {
  assert.deepEqual(extractClaims('- #11 merged:\n  - #12 merged\n  - #13 merged')
    .map((c) => c.ref.number), [11, 12, 13]);
});
