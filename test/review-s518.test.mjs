import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';
import { extractClaims as oldExtract } from './old/src/extract.mjs';
import { run as oldRun } from './old/src/cli.mjs';

const said = (t) => extractClaims(t).map((c) => `#${c.ref.number}=${c.said}`);
const merged = { state: 'merged', kind: 'pull', at: '2026-11-05T00:00:00Z', url: 'u' };
const exec = async (runner, extract, text, read) => {
  const lines = [];
  const code = await runner(['n.md', '--repo', 'o/r', '--alias', 'argent=o/argent'], { out: (l) => lines.push(l), extract, readFile: async () => text, read, env: {} });
  return { code, lines };
};

test('RED a plain paragraph above a blockquote keeps its claim', () => {
  assert.deepEqual(said('#13 open\n> Reviewer: #12 merged'), ['#13=open']);
});
test('RED a list item below a blockquote keeps its claim', () => {
  assert.deepEqual(said('> Reviewer: #12 merged\n- #13 open'), ['#13=open']);
});
test('PASS comparison: blank line between them keeps the claim', () => {
  assert.deepEqual(said('#13 open\n\n> Reviewer: #12 merged'), ['#13=open']);
});
test('RED a real contradiction beside a blockquote still exits 1, as it did', async () => {
  const text = '#13 open\n> Reviewer: #12 merged';
  const read = async () => merged;
  const before = await exec(oldRun, oldExtract, text, read);
  assert.equal(before.code, 1);
  assert.equal((await exec(run, extractClaims, text, read)).code, 1);
});
test('RED a blockquote in a nested list stays quoted', () => {
  assert.deepEqual(said('- - > waiting on #12'), []);
});
test('PASS comparison: a blockquote in one list stays quoted', () => {
  assert.deepEqual(said('- > waiting on #12'), []);
});
test('quoted trailing prose is masked before matching a queued obligation', () => {
  assert.deepEqual(said('argent#1768 owes one critic "not anymore"'), ['#1768=queued']);
  assert.deepEqual(said('argent#1768 owes one critic `done`'), ['#1768=queued']);
});
test('PASS comparison: unquoted trailing prose does not qualify', () => {
  assert.deepEqual(said('argent#1768 owes one critic, done'), []);
});
test('a failed queued read stops before a later contradiction, changing exit 1 to 2', async () => {
  const text = 'argent#1768 owes a review.\n\n#12 open';
  const reads = [];
  const read = async ({ repo }) => { reads.push(repo); if (repo === 'argent') throw new Error('GitHub answered 403'); return merged; };
  assert.equal((await exec(oldRun, oldExtract, text, read)).code, 1);
  reads.length = 0;
  const after = await exec(run, extractClaims, text, read);
  assert.equal(after.code, 2);
  assert.deepEqual(reads, ['argent']);
  assert.ok(after.lines.includes('This run is not complete.'));
});
test('a queued line lets its neighbour claim a state, changing exit 0 to 1', async () => {
  const text = 'argent#1768 owes a review\n#12 open';
  const read = async () => merged;
  assert.equal((await exec(oldRun, oldExtract, text, read)).code, 0);
  assert.deepEqual(said(text), ['#1768=queued', '#12=open']);
  assert.equal((await exec(run, extractClaims, text, read)).code, 1);
});
test('PASS comparison: a look alone exits 0', async () => {
  assert.equal((await exec(run, extractClaims, 'argent#1768 owes a review.', async () => merged)).code, 0);
});
test('PASS extraction is stable when run twice', () => {
  const t = 'argent#1768 owes one critic and waits on argent#1762.';
  assert.deepEqual(extractClaims(t), extractClaims(t));
});
