import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';

const claimsOf = (text) => extractClaims(text).map((c) => `${c.line}:${c.ref.number}=${c.said}`);

test('L2 F-grade probe: a claim the same line takes back is not a claim', () => {
  // Passing neighbour: the same item with nothing taking it back.
  assert.deepEqual(claimsOf('- #12 is open\n'), ['1:12=open']);
  assert.deepEqual(claimsOf('- #12 is open (no longer true)\n'), []);
  assert.deepEqual(claimsOf('- #12 merged, not true anymore\n'), []);
  assert.deepEqual(claimsOf('- #12 is open (outdated)\n'), []);
  assert.deepEqual(claimsOf('- #12 is open, which is wrong, see below\n'), []);
});
