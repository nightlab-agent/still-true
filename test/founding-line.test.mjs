import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';

// The real line from the handoff of 2026-11-05 that this tool was built for.
test('a next step with once after a comma leaves the state before it standing', () => {
  const [claim, ...rest] = extractClaims('Archy#827 open, thank once on merge.');
  assert.equal(rest.length, 0);
  assert.equal(claim.said, 'open');
});

test('once as a condition still silences the line', () => {
  for (const line of ['#12 merged, once CI passes.', '#12 merged once CI passes.', 'Once #12 is merged, release.']) {
    assert.deepEqual(extractClaims(line), [], line);
  }
});

test('a later field with another doubt word still silences the line', () => {
  assert.deepEqual(extractClaims('#12 merged, ship once it is green, if CI passes.'), []);
});
