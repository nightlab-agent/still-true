import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.mjs';

const claims = (list) => () => list;
const c = (line, ref, said) => ({ line, ref, said, quote: `q${line}` });
const io = () => { const o = []; return { out: (s) => o.push(s), o }; };
const base = { readFile: async () => 'note', token: undefined, defaultRepo: null };
const open = async () => ({ state: 'open', kind: 'pull', at: null, url: 'u' });
const one = claims([c(3, { number: 12 }, 'open')]);

test('without --strict, a run that verified nothing still exits 0', async () => {
  const { out } = io();
  assert.equal(await run(['h.md'], { ...base, out, extract: claims([]), read: open }), 0);
  assert.equal(await run(['h.md', '--repo', 'a/b'], { ...base, out, extract: one, read: async () => null }), 0);
});
test('--strict: no claims found exits 3 and says nothing was verified', async () => {
  const { out, o } = io();
  assert.equal(await run(['h.md', '--strict'], { ...base, out, extract: claims([]), read: open }), 3);
  assert.match(o.join('\n'), /--strict: nothing was verified/);
});
test('--strict: a claim GitHub has no record of exits 3', async () => {
  const { out, o } = io();
  assert.equal(await run(['h.md', '--repo', 'a/b', '--strict'], { ...base, out, extract: one, read: async () => null }), 3);
  assert.match(o.join('\n'), /--strict: 1 claim not checked/);
});
test('--strict: one claim checked and one not still exits 3', async () => {
  const { out } = io();
  const two = claims([c(3, { number: 12 }, 'open'), c(4, { number: 13 }, 'open')]);
  const read = async (ref) => (ref.number === 12 ? { state: 'open', kind: 'pull', at: null, url: 'u' } : null);
  assert.equal(await run(['h.md', '--repo', 'a/b', '--strict'], { ...base, out, extract: two, read }), 3);
});
test('--strict: every claim checked and true exits 0', async () => {
  const { out, o } = io();
  assert.equal(await run(['h.md', '--repo', 'a/b', '--strict'], { ...base, out, extract: one, read: open }), 0);
  assert.doesNotMatch(o.join('\n'), /--strict:/);
});
test('--strict: a contradiction stays exit 1', async () => {
  const { out } = io();
  const merged = async () => ({ state: 'merged', kind: 'pull', at: null, url: 'u' });
  assert.equal(await run(['h.md', '--repo', 'a/b', '--strict'], { ...base, out, extract: one, read: merged }), 1);
});
test('--strict: a failed read stays exit 2', async () => {
  const { out } = io();
  const read = async () => { throw new Error('boom'); };
  assert.equal(await run(['h.md', '--repo', 'a/b', '--strict'], { ...base, out, extract: one, read }), 2);
});
test('--strict --json: exit 3, one object, complete stays true, no text line', async () => {
  const { out, o } = io();
  assert.equal(await run(['h.md', '--strict', '--json'], { ...base, out, extract: claims([]), read: open }), 3);
  assert.equal(o.length, 1);
  const j = JSON.parse(o[0]);
  assert.equal(j.complete, true);
  assert.equal(j.counts.checked, 0);
  assert.equal(j.strict_failed, true);
});
test('--help documents --strict and exit 3', async () => {
  const { out, o } = io();
  assert.equal(await run(['--help'], { ...base, out, extract: claims([]), read: open }), 0);
  assert.match(o.join('\n'), /--strict/);
  assert.match(o.join('\n'), /exit 3/);
});
test('--strict is not read as a file or as the value of --repo', async () => {
  const { out, o } = io();
  assert.equal(await run(['h.md', '--repo', '--strict'], { ...base, out, extract: claims([]), read: open }), 2);
  assert.match(o.join('\n'), /--repo needs owner\/name/);
});
test('--strict judges each note: a claimless second note exits 3 and is named', async () => {
  const { out, o } = io();
  const extract = (text) => (text === 'first' ? [c(3, { number: 12 }, 'open')] : []);
  const readFile = async (f) => (f === 'a.md' ? 'first' : 'empty');
  assert.equal(await run(['a.md', 'b.md', '--repo', 'a/b', '--strict'], { ...base, readFile, out, extract, read: open }), 3);
  assert.match(o.join('\n'), /--strict: nothing was verified in b\.md/);
});
test('--strict: a claimless second note does not outrank a contradiction', async () => {
  const { out } = io();
  const extract = (text) => (text === 'first' ? [c(3, { number: 12 }, 'open')] : []);
  const readFile = async (f) => (f === 'a.md' ? 'first' : 'empty');
  const merged = async () => ({ state: 'merged', kind: 'pull', at: null, url: 'u' });
  assert.equal(await run(['a.md', 'b.md', '--repo', 'a/b', '--strict'], { ...base, readFile, out, extract, read: merged }), 1);
});
test('without --strict, a claimless second note stays exit 0', async () => {
  const { out } = io();
  const extract = (text) => (text === 'first' ? [c(3, { number: 12 }, 'open')] : []);
  const readFile = async (f) => (f === 'a.md' ? 'first' : 'empty');
  assert.equal(await run(['a.md', 'b.md', '--repo', 'a/b'], { ...base, readFile, out, extract, read: open }), 0);
});
