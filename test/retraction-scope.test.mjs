import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';
import { readState } from '../src/github.mjs';

const claimsOf = (text) => extractClaims(text).map((c) => [c.ref.number, c.said]);
const forms = [
  '#12 is open; no longer true, #13 is merged',
  '#12 is open, no longer true, #13 is merged',
  '#12 is open (no longer true), #13 is merged',
];

for (const note of forms) test(`retraction preserves the following independent claim: ${note}`, () => {
  const unread = [];
  const claims = extractClaims(note, { unread });
  assert.deepEqual(claims.map((c) => [c.line, c.ref.number, c.said]), [[1, 13, 'merged']]);
  assert.deepEqual(unread, [{ line: 1, ref: { number: 12 } }]);
});

for (const [note, expected] of [
  ['#13 is merged, #12 is open, no longer true', [[13, 'merged']]],
  ['#13 is merged, #12 is open (no longer true)', [[13, 'merged']]],
  ['#12 is open (no longer true, #13 is merged)', [[13, 'merged']]],
  ['#13 is merged (#12 is open, no longer true)', [[13, 'merged']]],
  ['#12 is open (no longer true), #12 is open', [[12, 'open']]],
  ['#12 open, #13 open; wrong, #14 merged', [[14, 'merged']]],
  ['#12 is open (no longer true, #13 is merged), closed', [[13, 'merged']]],
  ['#12 is open; no longer true, #13 is merged, maybe', []],
  ['#12 is open; no longer true, see #13, merged', []],
  ['#12 is open, #12 is open (no longer true), #13 merged', [[13, 'merged']]],
  ['2 open (#12, #13) (no longer true), #14 merged', [[14, 'merged']]],
  ['#12 is open (no longer true; #13 is merged)', [[13, 'merged']]],
  ['#13 is merged (#12 is open; no longer true)', [[13, 'merged']]],
]) test(`retraction scopes remain separate: ${note}`, () => {
  assert.deepEqual(claimsOf(note), expected);
});

test('control: semicolon retraction still takes back every claim in the preceding clause', () => {
  for (const note of [
    '#12 is open, #13 is open; no longer true',
    '#12 is open and #13 is open; no longer true',
    '#12 is open; no longer true',
    '#12 is open, no longer true',
    '#12 is open (no longer true)',
    '2 open (#12, #13), no longer true',
    '#12 is open (no longer true; see below)',
  ]) assert.deepEqual(claimsOf(note), [], note);
  assert.deepEqual(claimsOf('#11 merged; #12 open; wrong; incorrect'), [[11, 'merged']]);
});

test('control: a retraction does not give its subject to later bare states or unrelated references', () => {
  for (const note of [
    '#12 is open, no longer true, merged',
    '#12 is open (no longer true), merged',
    '#12 is open, no longer true, see #13, merged',
    '#12 is open (no longer true), see #13, merged',
    '#12 is open, no longer true, a PR for issue #13 is merged',
  ]) assert.deepEqual(claimsOf(note), [], note);
});

test('control: extra prose, masked retractions, conditions and history retain their scope', () => {
  for (const field of ['fixes outdated documentation', 'wrong label fixed', '"no longer true"', '`no longer true`']) {
    for (const note of [`#12 is open, ${field}, #13 is merged`, `#12 is open (${field}), #13 is merged`]) {
      assert.deepEqual(claimsOf(note), [[12, 'open'], [13, 'merged']], note);
    }
  }
  for (const note of forms) {
    for (const scoped of [`Old note: ${note}`, `If CI passes, ${note}`, `## History\n\n${note}`, `> ${note}`, `"${note}"`]) {
      assert.deepEqual(claimsOf(scoped), [], scoped);
    }
  }
});

test('control: a colon inside a larger field does not make its words a standalone retraction', () => {
  for (const [note, expected] of [
    ['#12 is open (reason: wrong), #13 is merged', [[12, 'open'], [13, 'merged']]],
    ['#12 is open, notes: wrong, #13 is merged', [[12, 'open'], [13, 'merged']]],
    ['#12 is open, wrong: documentation fixed, #13 is merged', [[12, 'open'], [13, 'merged']]],
    ['#12 is open: wrong', [[12, 'open']]],
  ]) assert.deepEqual(claimsOf(note), expected, note);
});

test('control: parenthetical semicolons keep their existing fact grammar without retractions', () => {
  assert.deepEqual(claimsOf('#12 open (#13 merged; #14 closed)'), [[12, 'open'], [13, 'merged']]);
});

test('a mention without a new subject does not steal the earlier subject retraction', () => {
  for (const note of [
    '#12 is open, see #13, no longer true',
    '#12 is open (see #13, no longer true)',
  ]) assert.deepEqual(claimsOf(note), [], note);
  for (const note of [
    '#12 is open, merged #13 (no longer true)',
    '#12 is open, waiting on #13 (no longer true)',
  ]) assert.deepEqual(claimsOf(note), [[12, 'open']], note);
});

test('retraction vocabulary preserves an independent claim in all three forms', () => {
  for (const words of ['not true', 'no longer the case', 'not accurate', 'not current', 'outdated', 'wrong', 'incorrect', 'which is wrong', 'not true anymore', 'this is now incorrect!']) {
    for (const note of [`#12 open; ${words}, #13 merged`, `#12 open, ${words}, #13 merged`, `#12 open (${words}), #13 merged`]) {
      assert.deepEqual(claimsOf(note), [[13, 'merged']], note);
    }
  }
});

test('standalone retractions still verify nothing, with strict exit 3 and ordinary exit 0', async () => {
  for (const note of ['#12 open; wrong', '#12 open, wrong', '#12 open (wrong)', '#12 is open, #13 is open; no longer true']) {
    for (const strict of [false, true]) {
      const output = [];
      const code = await run(['note.md', '--repo', 'a/b', '--json', ...(strict ? ['--strict'] : [])], {
        out: (line) => output.push(line), extract: extractClaims, readFile: async () => note,
        read: async () => assert.fail('retracted claims must not reach GitHub'), defaultRepo: null, env: {},
      });
      assert.equal(code, strict ? 3 : 0, note);
      const report = JSON.parse(output[0]);
      assert.deepEqual(report.claims, [], note);
      assert.equal(report.counts.checked, 0);
      assert.equal(report.strict_failed ?? false, strict);
      assert.equal(report.unread_references[0].reference, 'a/b#12');
    }
  }
});

test('repeat and concurrent runs check surviving claims without sharing retraction or read state', async () => {
  const invoke = async (actual) => {
    const output = [], reads = [];
    const code = await run(['note.md', '--repo', 'a/b', '--json', '--strict'], {
      out: (line) => output.push(line), extract: extractClaims, readFile: async () => forms[0], defaultRepo: null, env: {},
      read: (ref, options) => readState(ref, { ...options, fetchFn: async (url) => {
        reads.push(url);
        assert.equal(url, 'https://api.github.com/repos/a/b/issues/13');
        return new Response(JSON.stringify({ state: actual === 'merged' ? 'closed' : actual,
          pull_request: actual === 'merged' ? { merged_at: '2026-11-07T12:00:00Z' } : {},
        }), { status: 200 });
      } }),
    });
    return { code, output, reads };
  };
  const first = await invoke('merged');
  assert.equal(first.code, 0);
  assert.equal(first.reads.length, 1);
  assert.deepEqual(await invoke('merged'), first);
  const [matching, contradicted] = await Promise.all([invoke('merged'), invoke('open')]);
  assert.deepEqual(matching, first);
  assert.equal(contradicted.code, 1);
  assert.deepEqual(contradicted.reads, first.reads);
  assert.equal(JSON.parse(contradicted.output[0]).counts.contradicted, 1);
});

const cli = fileURLToPath(new URL('../bin/still-true.js', import.meta.url));
for (const note of forms) {
  for (const actual of ['merged', 'open']) test(`CLI checks only the surviving claim (${actual}): ${note}`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'still-true-retraction-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const file = join(dir, 'note.md'), preload = join(dir, 'transport.mjs');
    await writeFile(file, note);
    await writeFile(preload, `globalThis.fetch = async (url) => {
      if (url !== 'https://api.github.com/repos/a/b/issues/13') throw new Error('unexpected request: ' + url);
      return new Response(JSON.stringify({
        state: '${actual === 'merged' ? 'closed' : 'open'}',
        pull_request: { ${actual === 'merged' ? "merged_at: '2026-11-07T12:00:00Z'" : ''} },
        html_url: 'https://github.com/a/b/pull/13',
      }), { status: 200 });
    };\n`);
    for (const strict of [false, true]) {
      for (const json of [false, true]) {
        const result = spawnSync(process.execPath, [
          '--import', preload, cli, file, '--repo', 'a/b', ...(strict ? ['--strict'] : []), ...(json ? ['--json'] : []),
        ], { cwd: dir, encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH } });
        assert.equal(result.error, undefined);
        assert.equal(result.stderr, '');
        assert.equal(result.status, actual === 'merged' ? 0 : 1, result.stdout);
        if (json) {
          const report = JSON.parse(result.stdout);
          assert.equal(report.complete, true);
          assert.equal('strict_failed' in report, false);
          assert.deepEqual(report.counts, { checked: 1, contradicted: actual === 'merged' ? 0 : 1, looks: 0, notChecked: 0 });
          assert.deepEqual(report.claims, [{ file, line: 1, reference: 'a/b#13', said: 'merged', actual,
            kind: actual === 'merged' ? 'ok' : 'contradiction', url: 'https://github.com/a/b/pull/13' }]);
          assert.deepEqual(report.unread_references, [{ file, line: 1, reference: 'a/b#12' }]);
        } else {
          assert.match(result.stdout, /no claim read: #12/);
          assert.match(result.stdout, new RegExp(`1 claim checked, ${actual === 'merged' ? 0 : 1} contradicted, 1 reference with no claim read`));
          if (actual === 'open') assert.match(result.stdout, /said merged, but a\/b#13 is open/);
          else assert.doesNotMatch(result.stdout, /said .*but/);
        }
      }
    }
    assert.equal(await readFile(file, 'utf8'), note);
  });
}
