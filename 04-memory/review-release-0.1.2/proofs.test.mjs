// Review evidence: F1 and F2 intentionally fail on this release candidate.
// Run explicitly with node --test; this file is outside the npm test glob.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../../src/extract.mjs';

test('F1: uncertainty in the same once field must stay uncertain', () => {
  assert.deepEqual(extractClaims('#1 merged, maybe once CI passes.'), []);
});

test('F1 control: a later thank-you step preserves the current state', () => {
  assert.deepEqual(
    extractClaims('#1 merged, thank once on merge.').map(({ said }) => said),
    ['merged'],
  );
});

test('F2: a blockquote must not end an Old note scope', () => {
  assert.deepEqual(extractClaims('Old note:\n> context\n- #1 open'), []);
});

test('F2 control: a blockquote without a historical label preserves the next item', () => {
  assert.deepEqual(
    extractClaims('> context\n- #1 open').map(({ said }) => said),
    ['open'],
  );
});
