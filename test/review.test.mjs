import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, repoFromRemote } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';
import { readState } from '../src/github.mjs';
import { compare } from '../src/compare.mjs';

const OPEN = { state: 'open', kind: 'pull', at: null, url: 'u' };
const MERGED = { state: 'merged', kind: 'pull', at: '2026-11-05T00:00:00Z', url: 'u' };
async function go(text, real, more = {}) {
  const o = [];
  const files = more.files ?? { 'n.md': text };
  const code = await run([...Object.keys(files), '--repo', 'a/b'], { out: (s) => o.push(s), extract: extractClaims,
    readFile: async (f) => { if (files[f] === null) throw new Error('ENOENT'); return files[f]; },
    read: async () => real, token: null, env: {} });
  return { code, text: o.join('\n') };
}
// Each pair: [the nearest normal case, the case the note does not mean as a present claim]
const open12 = [
  ['A condition: once', 'If PR #12 is merged, release 0.2.', 'Once PR #12 is merged, release 0.2.'],
  ['A condition: until', 'Do not release if PR #12 is merged.', 'Do not release until PR #12 is merged.'],
  ['A condition: when', 'Ship if PR #12 is merged.', 'Ship when PR #12 is merged.'],
  ['A condition: after', 'If PR #12 is merged, deploy.', 'After PR #12 is merged, deploy.'],
  ['A goal: need', 'I think PR #12 is merged.', 'Need PR #12 merged.'],
  ['A goal: get', 'I think PR #12 is merged.', 'Next: get PR #12 merged.'],
  ['A future date', '#12 should be merged by Friday.', '#12 merged by Friday.'],
  ['A later condition', '#12 merged if CI passes.', '#12 merged once CI passes.'],
  ['Not upstream', '#12 merged into my local branch.', '#12 merged locally.'],
  ['Negation by contraction', 'I have not merged #12 yet.', "I haven't merged #12 yet."],
  ['Closed then reopened', '#12 is reopened.', '#12 closed, then reopened.'],
];
for (const [name, normal, bad] of open12) {
  test(`comparison, ${name}: "${normal}" raises nothing on an open PR`, async () => {
    assert.equal((await go(normal, OPEN)).code, 0);
  });
  test(`review, ${name}: "${bad}" raises nothing on an open PR`, async () => {
    const r = await go(bad, OPEN);
    assert.equal(r.code, 0, r.text);
  });
}
const merged12 = [
  ['A second fact after a comma', 'PR #12 merged, follow-up tracked.', 'PR #12 merged, open question on naming.'],
];
for (const [name, normal, bad] of merged12) {
  test(`comparison, ${name}: "${normal}" raises nothing on a merged PR`, async () => {
    assert.equal((await go(normal, MERGED)).code, 0);
  });
  test(`review, ${name}: "${bad}" raises nothing on a merged PR`, async () => {
    const r = await go(bad, MERGED);
    assert.equal(r.code, 0, r.text);
  });
}
test('comparison: a state after a comma with no second ref belongs to the subject', () => {
  assert.deepEqual(extractClaims('#12 depends on the release, closed yesterday.').map((c) => c.said), ['closed']);
});
test('review: a state after a second ref is about that ref, not the subject', async () => {
  const r = await go('#12 depends on #13, closed yesterday.', OPEN);
  assert.equal(r.code, 0, r.text);
});
test('comparison: imperative "Reopen PR #12" gives no claim', () => assert.deepEqual(extractClaims('Reopen PR #12.'), []));
test('review: imperative "Open PR #12 next" gives no claim', () => assert.deepEqual(extractClaims('Open PR #12 next.'), []));
test('review: "re-open PR #12" gives no claim', () => assert.deepEqual(extractClaims('re-open PR #12.'), []));

// Stated in a section the README says stays out
test('comparison: History heading keeps old claims out', async () => {
  assert.equal((await go('# History\n\n#12 is open\n\n## Now\n\nnothing\n', MERGED)).code, 0);
});
test('review: a byte order mark must not turn History into a read section', async () => {
  const r = await go('﻿# History\n\n#12 is open\n\n## Now\n\nnothing\n', MERGED);
  assert.equal(r.code, 0, r.text);
});
test('review: a stray opening quote must not walk a read into History', async () => {
  const r = await go(`## Now\n\nThe bot said "ship it\n\n## History\n\nThe bot said ship" then.\n#12 is open\n`.replace('then.\n', 'then.\n\n'), MERGED);
  assert.equal(r.code, 0, r.text);
});
// Silent loss
test('comparison: no headings, file read whole', async () => {
  assert.equal((await go('some intro\n\n#12 is open\n', MERGED)).code, 1);
});
test('review: front matter is not a heading, file with none is still read whole', async () => {
  const r = await go('---\nname: x\n---\n\n#12 is open\n', MERGED);
  assert.equal(r.code, 1, r.text);
});
test('review: a stray quote does not silence the rest of the file', async () => {
  const r = await go(`we rock 'n roll\n\n#12 is open\n`, MERGED);
  assert.equal(r.code, 1, r.text);
});
test('comparison: a closed quote silences only itself', async () => {
  assert.equal((await go(`we said "go"\n\n#12 is open\n`, MERGED)).code, 1);
});
test('review: list item before a thematic break is not a setext heading', async () => {
  const r = await go('# Now\n\n- #12 is open\n---\n\n- #13 is open\n', MERGED);
  assert.match(r.text, /2 claims checked/);
});
// Wrong exit
const bin = new URL('../bin/still-true.js', import.meta.url).pathname;
const cli = (note, ...args) => {
  const d = mkdtempSync(join(tmpdir(), 'st-')); const f = join(d, 'n.md'); writeFileSync(f, note);
  return spawnSync('node', [bin, f, ...args], { encoding: 'utf8', cwd: d, env: { PATH: process.env.PATH } });
};
test('comparison: an unknown short name exits 0 with not checked', () => {
  const r = cli('Archy#12 is open\n', '--repo', 'a/b');
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /not checked/);
});
test('review: a short name equal to an Object member exits 0 with not checked', () => {
  const r = cli('constructor#12 is open\n', '--repo', 'a/b');
  assert.equal(r.status, 0, r.stderr.slice(0, 300)); assert.match(r.stdout, /not checked/);
});
test('review: an unreadable second file after a contradiction exits 1, as a failed read does', async () => {
  const r = await go('', MERGED, { files: { 'a.md': '#12 is open\n', 'b.md': null } });
  assert.equal(r.code, 1, r.text);
});
test('comparison: repoFromRemote refuses another host', () => assert.equal(repoFromRemote('https://gitlab.com/a/b.git'), null));
test('review: repoFromRemote refuses a look-alike host', () => {
  assert.equal(repoFromRemote('https://notgithub.com/a/b.git'), null);
  assert.equal(repoFromRemote('https://gitlab.com/group/github.com/a/b.git'), null);
});
test('review: a 200 with no state is not a contradiction', async () => {
  const real = await readState({ owner: 'a', repo: 'b', number: 1 }, { fetchFn: async () => ({ status: 200, ok: true, json: async () => ({}) }) }).catch(() => null);
  assert.notEqual(real && compare({ said: 'open' }, real).verdict, 'contradicted');
});
test('review: an alias with no slash is refused, not reported as GitHub having no such issue', async () => {
  const o = [];
  await run(['n.md', '--alias', 'A=foo'], { out: (s) => o.push(s), extract: extractClaims, readFile: async () => 'A#1 is open\n',
    read: async () => null, defaultRepo: null, env: {} });
  assert.doesNotMatch(o.join('\n'), /undefined/);
});
// Pass-expected hunts
test('hunt: two spellings of one PR cost one request and agree', async () => {
  let n = 0; const o = [];
  const code = await run(['n.md'], { out: (s) => o.push(s), extract: extractClaims, readFile: async () => 'Foo/Bar#1 is open\n\nfoo/bar#1 is open\n\nFOO/BAR#1 is merged\n',
    read: async () => { n++; return MERGED; }, defaultRepo: null, env: {} });
  assert.equal(n, 1); assert.equal(code, 1); assert.match(o.join('\n'), /3 claims checked, 2 contradicted/);
});
test('hunt: a 404 is cached, not re-read', async () => {
  let n = 0;
  await run(['n.md', '--repo', 'a/b'], { out() {}, extract: extractClaims, readFile: async () => '#1 is open\n\n#1 is merged\n', read: async () => { n++; return null; }, env: {} });
  assert.equal(n, 1);
});
