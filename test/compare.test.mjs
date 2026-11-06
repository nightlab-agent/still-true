import test from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../src/compare.mjs';

const claim = (said) => ({ line: 3, ref: { number: 12 }, said, quote: 'x' });
const real = (state, kind = 'pull') => ({ state, kind, at: '2026-11-05T19:19:00Z', url: 'u' });

test('said open, is merged: contradiction', () => {
  assert.equal(compare(claim('open'), real('merged')).verdict, 'contradicted');
});
test('said open, is open: fine', () => {
  assert.equal(compare(claim('open'), real('open')).verdict, 'ok');
});
test('said closed, is merged: a merged PR is closed, fine', () => {
  assert.equal(compare(claim('closed'), real('merged')).verdict, 'ok');
});
test('said merged, closed unmerged: contradiction', () => {
  assert.equal(compare(claim('merged'), real('closed')).verdict, 'contradicted');
});
test('said merged, still open: contradiction', () => {
  assert.equal(compare(claim('merged'), real('open')).verdict, 'contradicted');
});
test('said merged of an issue: closed issue is fine, it cannot merge', () => {
  assert.equal(compare(claim('merged'), real('closed', 'issue')).verdict, 'ok');
});
test('unknown state: unknown, never a contradiction', () => {
  assert.equal(compare(claim('open'), null).verdict, 'unknown');
});
