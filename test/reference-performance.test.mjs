import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { extractClaims } from '../src/extract.mjs';

test('a long reference-character run after a reference finishes within the subprocess budget', () => {
  // A runner timeout cannot interrupt a synchronous regexp on its own thread.
  // At the baseline this input took seconds; keep the kill in the parent process.
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { extractClaims } from ${JSON.stringify(new URL('../src/extract.mjs', import.meta.url).href)};
    const run = 'a'.repeat(160000);
    const unread = [];
    assert.deepEqual(extractClaims('#12 ' + run, { unread }), []);
    assert.deepEqual(unread, [{ line: 1, ref: { number: 12 } }]);
    const cases = [
      ['#12 open ' + run, [12]],
      [run + '; #13 merged', [13]],
      ['#12 open; ' + run + '; #13 closed', [12, 13]],
      [run + ' #14 open', []],
      [run + '#', []],
      [run, []],
    ];
    for (const [text, wanted] of cases) {
      assert.deepEqual(extractClaims(text).map((claim) => claim.ref.number), wanted);
    }
    console.log('parsed');
  `], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'parsed');
});

test('reference-character runs preserve claims at either end and conservative refusals', () => {
  const run = 'a0_./-'.repeat(40);
  const cases = [
    [`#12 open ${run}`, [12], []],
    [`${run}; #13 merged`, [13], []],
    [`#12 open; ${run}; #13 closed`, [12, 13], []],
    [`${run} #14 open`, [], [14]],
    [`${run}#15 open`, [], []], // An invalid path must not become a shorter repo name.
    [`#12 open ${run}#16, closed`, [12], []],
    ['#12 open Repo#16, closed', [12], [16]],
    [`${run}#`, [], []],
    [run, [], []],
    [`#12 open ${run}, maybe`, [], [12]],
    [`#12 open ${run}; no longer true`, [], [12]],
  ];
  for (const [text, wanted, unreadWanted] of cases) {
    const unread = [];
    assert.deepEqual(extractClaims(text, { unread }).map((claim) => claim.ref.number), wanted, text);
    assert.deepEqual(unread.map((entry) => entry.ref.number), unreadWanted, text);
  }
});
