import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';

const unreadOf = (text) => { const unread = []; extractClaims(text, { unread }); return unread; };
const refs = (text) => unreadOf(text).map((u) => `${u.line} ${u.ref.owner ?? ''}/${u.ref.repo ?? ''}#${u.ref.number}`);
const open = async () => ({ state: 'open', kind: 'pull', at: null, url: 'u' });
const exec = async (text, ...flags) => {
  const o = [];
  const code = await run(['h.md', '--repo', 'a/b', ...flags], {
    out: (s) => o.push(s), extract: extractClaims, readFile: async () => text, read: open, token: undefined, defaultRepo: null });
  return { code, text: o.join('\n') };
};

// s600, a real handoff: "until" in the sentence dropped its references, exit 0, 4 of 9 refs read.
const REAL = '## Now\n\n7. PRs open 5/5, no new one until a slot frees. Bench open: Archy#781, x/y#696.\n8. #427 is open\n';

test('a reference on a read line with no claim is listed, with its line', () => {
  assert.deepEqual(refs('## Now\n\nsee #12\n'), ['3 /#12']);
});
test('a reference that made a claim is not listed', () => {
  assert.deepEqual(refs('## Now\n\n- #12 is open\n'), []);
});
test('the same line can hold a claim and a dropped reference', () => {
  assert.deepEqual(refs('## Now\n\n- #12 is open, see #13\n'), ['3 /#13']);
});
test('references in skipped sections, fences, code, quotes, comments and front matter are not reading gaps', () => {
  const text = '---\nsee: #1\n---\n## History\n\nsee #2\n\n## Now\n\n```\n#3\n```\n\nuse `#4` and "#5"\n\n<!-- #6 -->\n\n    #7\n\n> #8\n';
  assert.deepEqual(refs(text), []);
});
test('a link fragment, a colour and a heading word are not references', () => {
  assert.deepEqual(refs('## Now\n\nhttps://github.com/a/b/pull/3#issuecomment-9 and https://e.com/a#12 and #fff and #abc\n'), []);
});
test('a reference ending a sentence or in brackets is found', () => {
  assert.deepEqual(refs('## Now\n\nsee #12. Also (a/b#13) and Archy#14, fine\n'), ['3 /#12', '3 a/b#13', '3 /Archy#14']);
});
test('twice on one line is listed once; a dropped planning item is listed', () => {
  assert.deepEqual(refs('## Now\n\nsee #12 and again #12\n'), ['3 /#12']);
  assert.deepEqual(refs('## Now\n\n- Next steps:\n  - #5 is open\n'), ['4 /#5']);
});
test('the run says which references it read no claim from, and the exit does not move', async () => {
  const r = await exec(REAL);
  assert.equal(r.code, 0);
  assert.match(r.text, /1 claim checked, 0 contradicted, 2 references with no claim read/);
  assert.match(r.text, /h\.md:3 {2}no claim read: Archy#781, x\/y#696/);
});
test('--strict does not fail on a bare reference alone', async () => {
  const r = await exec('## Now\n\n- #1 is open, see #2\n', '--strict');
  assert.equal(r.code, 0);
  assert.match(r.text, /1 reference with no claim read/);
});
test('no claims at all still names the references, and --strict still exits 3', async () => {
  const r = await exec('## Now\n\nsee #2\n', '--strict');
  assert.equal(r.code, 3);
  assert.match(r.text, /h\.md:3 {2}no claim read: #2/);
  assert.match(r.text, /no claims about PR or issue state found/);
});
test('--json lists them, resolved, and leaves counts alone', async () => {
  const r = JSON.parse((await exec('## Now\n\n- #1 is open, see #2\n', '--json')).text);
  assert.deepEqual(r.unread_references, [{ file: 'h.md', line: 3, reference: 'a/b#2' }]);
  assert.deepEqual(Object.keys(r.counts), ['checked', 'contradicted', 'looks', 'notChecked']);
});
test('--json omits the field when nothing was left behind', async () => {
  const r = JSON.parse((await exec('## Now\n\n- #1 is open\n', '--json')).text);
  assert.equal('unread_references' in r, false);
});
