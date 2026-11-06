import test from 'node:test';
import assert from 'node:assert/strict';
import { readState, resolveRef } from '../src/github.mjs';

const reply = (status, body) => ({ status, ok: status < 400, json: async () => body, headers: new Headers() });

test('a merged PR reads merged, with the merge time', async () => {
  const calls = [];
  const fetchFn = async (url) => { calls.push(url); return reply(200, {
    state: 'closed', html_url: 'u', pull_request: { merged_at: '2026-11-05T19:19:00Z' }, closed_at: '2026-11-05T19:19:00Z' }); };
  const r = await readState({ owner: 'a', repo: 'b', number: 7 }, { fetchFn });
  assert.deepEqual(r, { state: 'merged', kind: 'pull', at: '2026-11-05T19:19:00Z', url: 'u' });
  assert.equal(calls.length, 1, 'the issues endpoint answers for PRs too, one request is enough');
  assert.match(calls[0], /\/repos\/a\/b\/issues\/7$/);
});
test('a PR closed unmerged reads closed', async () => {
  const fetchFn = async () => reply(200, { state: 'closed', html_url: 'u', pull_request: { merged_at: null }, closed_at: 'T' });
  assert.equal((await readState({ owner: 'a', repo: 'b', number: 7 }, { fetchFn })).state, 'closed');
});
test('an issue reads as an issue', async () => {
  const fetchFn = async () => reply(200, { state: 'open', html_url: 'u', created_at: 'T' });
  const r = await readState({ owner: 'a', repo: 'b', number: 7 }, { fetchFn });
  assert.equal(r.kind, 'issue'); assert.equal(r.state, 'open');
});
test('404 is unknown, never open or closed', async () => {
  const fetchFn = async () => reply(404, {});
  assert.equal(await readState({ owner: 'a', repo: 'b', number: 7 }, { fetchFn }), null);
});
test('rate limit throws, so a run cannot look clean when nothing was read', async () => {
  const fetchFn = async () => reply(403, { message: 'API rate limit exceeded' });
  await assert.rejects(readState({ owner: 'a', repo: 'b', number: 7 }, { fetchFn }), /rate limit/i);
});
test('a token goes in the header, never the url', async () => {
  let seen;
  const fetchFn = async (url, init) => { seen = { url, init }; return reply(200, { state: 'open', html_url: 'u' }); };
  await readState({ owner: 'a', repo: 'b', number: 7 }, { fetchFn, token: 'FAKE' });
  assert.equal(seen.init.headers.authorization, 'Bearer FAKE');
  assert.ok(!seen.url.includes('FAKE'));
});
test('resolveRef: full ref stays', () => {
  assert.deepEqual(resolveRef({ owner: 'a', repo: 'b', number: 1 }, {}), { owner: 'a', repo: 'b', number: 1 });
});
test('resolveRef: #12 takes the default repo', () => {
  assert.deepEqual(resolveRef({ number: 12 }, { defaultRepo: 'a/b' }), { owner: 'a', repo: 'b', number: 12 });
});
test('resolveRef: short form takes an alias', () => {
  assert.deepEqual(resolveRef({ repo: 'Archy', number: 8 }, { aliases: { Archy: 'hslee16/Archy' } }),
    { owner: 'hslee16', repo: 'Archy', number: 8 });
});
test('resolveRef: short form with no alias is null, never a guessed owner', () => {
  assert.equal(resolveRef({ repo: 'Archy', number: 8 }, { defaultRepo: 'a/b' }), null);
});
test('resolveRef: #12 with no default repo is null', () => {
  assert.equal(resolveRef({ number: 12 }, {}), null);
});
test('resolveRef: short form naming the default repo resolves to it', () => {
  assert.deepEqual(resolveRef({ repo: 'b', number: 8 }, { defaultRepo: 'a/b' }), { owner: 'a', repo: 'b', number: 8 });
});
