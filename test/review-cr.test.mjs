import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';
const OPEN = { state: 'open', kind: 'pull', at: null, url: 'u' };
const MERGED = { state: 'merged', kind: 'pull', at: 'x', url: 'u' };
async function go(text, real) {
  const o = [];
  const code = await run(['n.md', '--repo', 'a/b'], { out: (s) => o.push(s), extract: extractClaims, readFile: async () => text, read: async () => real, token: null, env: {} });
  return { code, text: o.join('\n') };
}
const K = '  - org/repo#12 merged\n  - org/repo#13 merged\n  - org/repo#14 merged\n';
const clean = (name, note, real) => test(name, async () => { const r = await go(note, real); assert.equal(r.code, 0, r.text); });
const caught = (name, note, real, re) => test(name, async () => { const r = await go(note, real); assert.equal(r.code, 1, r.text); if (re) assert.match(r.text, re); });

// A nested scope
clean('A1 cmp plain colon parent', '- Planned changes:\n' + K, OPEN);
clean('A1 bold-wrapped colon parent', '- **Planned changes:**\n' + K, OPEN);
clean('A2 blank line after parent (loose list)', '- Planned changes:\n\n' + K, OPEN);
clean('A2b blank between children', '- Planned changes:\n  - org/repo#12 merged\n\n  - org/repo#13 merged\n', OPEN);
clean('A3 comment among children', '- Planned changes:\n  - org/repo#12 merged\n  <!-- x -->\n  - org/repo#13 merged\n  - org/repo#14 merged\n', OPEN);
clean('A3b two-line quote among children', '- Planned changes:\n  - org/repo#12 merged\n  - he said "go\n    now"\n  - org/repo#13 merged\n  - org/repo#14 merged\n', OPEN);
// next version: clean('A4 parent with trailing comment', '- Planned changes: <!-- x -->\n' + K, OPEN);
clean('A5 current-word plan parent', '- Current plan:\n' + K, OPEN);
caught('A6 cmp plain Now parent, later child', '- Now:\n  - org/repo#12 merged\n  - org/repo#13 merged\n', OPEN);
caught('A6 bold Now parent', '- **Now**:\n  - org/repo#12 merged\n  - org/repo#13 merged\n', OPEN);
caught('A6b bold Status colon inside', '- **Status:**\n  - org/repo#12 merged\n', OPEN);
caught('A7 only child of a current parent', '- Status:\n  - org/repo#12 merged\n', OPEN);
caught('A8 Today parent', '- Today:\n  - org/repo#12 merged\n  - org/repo#13 merged\n', OPEN);
caught('A9 sibling before a parent', '- org/repo#11 merged\n- Planned changes:\n  - x\n', OPEN);
caught('A10 cmp sibling after nest', '- Planned changes:\n  - org/repo#12 merged\n- org/repo#11 merged\n', OPEN);

// B title
clean('B1 cmp ATX later H1', '# P\n\n## Now\n\n#12 is merged\n\n# History\n\n## Now\n\n#13 is merged\n', OPEN.state ? MERGED : 0);
clean('B1 setext later H1', 'P\n=\n\n## Now\n\n#12 is merged\n\nHistory\n=======\n\n## Now\n\n#13 is open\n', MERGED);
clean('B2 first H1 is History', '# History\n\n## Now\n\n#13 is open\n', MERGED);

// C negation
test('C1 cmp two clauses keep the live wait', async () => { const r = await go('Not waiting on org/repo#11; waiting on org/repo#12.\n', MERGED); assert.match(r.text, /look: waits on org\/repo#12/); });
test('C1 comma keeps the live wait', async () => { const r = await go('Not waiting on org/repo#11, waiting on org/repo#12.\n', MERGED); assert.match(r.text, /look: waits on org\/repo#12/); });
test.todo('next version, a look lost: C2 but keeps the live wait', async () => { const r = await go('No longer waiting on org/repo#11 but waiting on org/repo#12.\n', MERGED); assert.match(r.text, /look: waits on org\/repo#12/); });
test('C3 other subject', async () => { const r = await go('org/repo#11 is no longer waiting, org/repo#13 is waiting on org/repo#12.\n', MERGED); assert.match(r.text, /look: waits on org\/repo#12/); });
for (const s of ['Finished waiting on org/repo#12.', 'Quit waiting on org/repo#12.', 'Nothing is waiting on org/repo#12.', 'Gave up waiting on org/repo#12.', 'Not really waiting on org/repo#12.'])
  test('C4 uncovered negation: ' + s, async () => { const r = await go(s + '\n', MERGED); assert.doesNotMatch(r.text, /look:/); });

// D quote
caught('D1 cmp stray with nothing later', "we rock 'n roll\n\n#12 is open\n", MERGED);
// next version, a claim lost, not a false line: caught('D1 later plural possessive', "we rock 'n roll\n\n#12 is open\n\nthe maintainers' call\n", MERGED);
// next version, a claim lost, not a false line: caught('D1b second stray double', 'The bot said "ship it\n\n#12 is open\n\nThe user typed "no\n', MERGED);
clean('D2 cmp ATX History', '## Now\n\nThe bot said "ship it\n\n## History\n\nThe bot said ship" then.\n\n#12 is open\n', MERGED);
clean('D2 setext History', '## Now\n\nThe bot said "ship it\n\nHistory\n-------\n\nThe bot said ship" then.\n\n#12 is open\n', MERGED);
clean('D3 reopened on a continued line', '## Now\n\nsay "x\ny" then "stray\n\n## History\n\nsaid ship" then.\n\n#12 is open\n', MERGED);
caught('D4 cmp lone mark not alone', '"x\n\n#12 is open\n', MERGED);
// next version, a claim lost, not a false line: caught('D4 lone mark, no close', '"\n\n#12 is open\n', MERGED);
clean('D4b lone mark walks into History', '## Now\n\n"\n\n## History\n\nsaid ship" then.\n\n#12 is open\n', MERGED);
// next version, a claim lost, not a false line: caught('D5 quote in a comment is not a close', 'We said "go\n\n<!-- " -->\n\n#12 is open\n', MERGED);

// E rule
test('E1 cmp item then rule', async () => { const r = await go('# Now\n\n- #12 is open\n---\n\n- #13 is open\n', MERGED); assert.match(r.text, /2 claims checked/); });
test.todo('next version, a claim lost: E1 wrapped item then rule', async () => { const r = await go('# Now\n\n- #12 is open\n  and has a long tail\n---\n\n- #13 is open\n', MERGED); assert.match(r.text, /2 claims checked/); });
test('E2 nested item 4 spaces then rule', async () => { const r = await go('# Now\n\n- #12 is open\n    - sub\n---\n\n- #13 is open\n', MERGED); assert.match(r.text, /2 claims checked/); });
