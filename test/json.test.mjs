import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';
import { readState } from '../src/github.mjs';

const merged = { state: 'merged', kind: 'pull', at: null, url: 'https://github.com/a/b/pull/1' };
const invoke = async (argv, overrides = {}) => {
  const lines = [];
  const code = await run(argv, {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => '#1 open', read: async () => merged,
    defaultRepo: null, env: {}, ...overrides,
  });
  assert.equal(lines.length, 1, 'exactly one JSON object, with no text lines');
  return { code, report: JSON.parse(lines[0]) };
};

test('JSON includes every kind of claim, known URLs, and counts', async () => {
  const { code, report } = await invoke(['note.md', '--repo', 'a/b', '--json'], {
    readFile: async () => '- #1 open\n- waiting on #2\n- #3 closed\n- #4 open\n- Tool#5 open',
    read: async ({ number }) => number === 4 ? null : { ...merged, url: `https://github.com/a/b/pull/${number}` },
  });
  assert.equal(code, 1);
  assert.deepEqual(report, {
    schema: 1, complete: true, reason: null,
    counts: { checked: 3, contradicted: 1, looks: 1, notChecked: 2 },
    claims: [
      { file: 'note.md', line: 1, reference: 'a/b#1', said: 'open', actual: 'merged', kind: 'contradiction', url: merged.url },
      { file: 'note.md', line: 2, reference: 'a/b#2', said: 'waiting', actual: 'merged', kind: 'look', url: 'https://github.com/a/b/pull/2' },
      { file: 'note.md', line: 3, reference: 'a/b#3', said: 'closed', actual: 'merged', kind: 'ok', url: 'https://github.com/a/b/pull/3' },
      { file: 'note.md', line: 4, reference: 'a/b#4', said: 'open', actual: null, kind: 'not checked' },
      { file: 'note.md', line: 5, reference: 'Tool#5', said: 'open', actual: null, kind: 'not checked' },
    ],
  });
});

test('JSON keeps a contradiction before a failed GitHub read and includes remaining extracted claims', async () => {
  const { code, report } = await invoke(['--json', 'note.md', '--repo', 'a/b'], {
    readFile: async () => '- #1 open\n- #2 open\n- #3 open',
    read: (ref) => ref.number === 1 ? merged : readState(ref, {
      fetchFn: async () => ({ ok: false, status: 403, json: async () => ({ message: 'API rate limit exceeded\ntry "later"' }) }),
    }),
    env: { HTTPS_PROXY: 'http://proxy:1' },
  });
  assert.equal(code, 1);
  assert.equal(report.complete, false);
  assert.equal(report.reason, 'GitHub answered 403 for a/b#2: API rate limit exceeded\ntry "later"');
  assert.deepEqual(report.counts, { checked: 1, contradicted: 1, looks: 0, notChecked: 2 });
  assert.deepEqual(report.claims.map(({ kind, actual }) => ({ kind, actual })), [
    { kind: 'contradiction', actual: 'merged' },
    { kind: 'not checked', actual: null },
    { kind: 'not checked', actual: null },
  ]);
});

test('JSON has zero counts and an empty array when no claims are found', async () => {
  const { code, report } = await invoke(['empty.md', '--json'], {
    readFile: async () => 'Nothing to report.', read: async () => assert.fail('no request'),
  });
  assert.equal(code, 0);
  assert.deepEqual(report, {
    schema: 1, complete: true, reason: null,
    counts: { checked: 0, contradicted: 0, looks: 0, notChecked: 0 }, claims: [],
  });
});

test('JSON combines two files and caches references without losing either claim', async () => {
  let reads = 0;
  const { code, report } = await invoke(['one.md', 'two.md', '--json', '--repo', 'a/b'], {
    readFile: async (file) => file === 'one.md' ? '#1 open' : '\n#1 closed',
    read: async () => { reads++; return merged; },
  });
  assert.equal(code, 1);
  assert.equal(reads, 1);
  assert.equal(report.complete, true);
  assert.deepEqual(report.counts, { checked: 2, contradicted: 1, looks: 0, notChecked: 0 });
  assert.deepEqual(report.claims.map(({ file, line, kind }) => ({ file, line, kind })), [
    { file: 'one.md', line: 1, kind: 'contradiction' },
    { file: 'two.md', line: 2, kind: 'ok' },
  ]);
});

for (const contradicted of [false, true]) {
  test(`JSON preserves exit status for an unreadable file after contradicted=${contradicted}`, async () => {
    const { code, report } = await invoke(['one.md', 'missing.md', '--json', '--repo', 'a/b'], {
      readFile: async (file) => {
        if (file === 'missing.md') throw new Error('ENOENT');
        return contradicted ? '#1 open' : '#1 closed';
      },
    });
    assert.equal(code, contradicted ? 1 : 2);
    assert.equal(report.complete, false);
    assert.equal(report.reason, 'missing.md: cannot read: ENOENT');
    assert.equal(report.claims.length, 1);
    assert.equal(report.counts.contradicted, Number(contradicted));
  });
}

test('JSON failed first read exits 2 and cannot look complete', async () => {
  const { code, report } = await invoke(['note.md', '--json', '--repo', 'a/b'], {
    read: async () => { throw new Error('fetch failed'); },
  });
  assert.equal(code, 2);
  assert.equal(report.complete, false);
  assert.equal(report.reason, 'fetch failed');
  assert.deepEqual(report.counts, { checked: 0, contradicted: 0, looks: 0, notChecked: 1 });
  assert.equal(report.claims[0].kind, 'not checked');
});

for (const argv of [
  ['--json'], ['--json', '--nope'], ['--json', 'note.md', '--repo', 'invalid'], ['--json', 'note.md', '--alias'],
  ['note.md', '--repo', '--json'], ['note.md', '--alias', '--json'],
]) {
  test(`JSON bad usage stays JSON: ${argv.join(' ')}`, async () => {
    const { code, report } = await invoke(argv, { readFile: async () => assert.fail('no file read') });
    assert.equal(code, 2);
    assert.equal(report.complete, false);
    assert.equal(typeof report.reason, 'string');
    assert.ok(report.reason.length > 0);
    assert.deepEqual(report.claims, []);
  });
}

test('JSON and help can be combined without text outside the object', async () => {
  const { code, report } = await invoke(['--help', '--json']);
  assert.equal(code, 0);
  assert.match(report.help, /--json/);
  assert.deepEqual(report.claims, []);
});

test('JSON reports are isolated across repeated and simultaneous invocations', async () => {
  const argv = ['note.md', '--json', '--repo', 'a/b'];
  const first = await invoke(argv);
  assert.deepEqual(await invoke(argv), first);
  const [bad, good] = await Promise.all([
    invoke(argv), invoke(argv, { read: async () => ({ state: 'open', kind: 'pull' }) }),
  ]);
  assert.deepEqual(bad, first);
  assert.equal(good.code, 0);
  assert.equal(good.report.claims[0].kind, 'ok');
  assert.equal(good.report.claims[0].actual, 'open');
  assert.ok(!Object.hasOwn(good.report.claims[0], 'url'));
});

test('the real CLI emits one JSON object for real files, unresolved refs and unreadable files', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'still-true-json-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'note.md');
  await writeFile(file, 'Tool#1 open\n');
  const cli = fileURLToPath(new URL('../bin/still-true.js', import.meta.url));
  for (const [files, status, complete] of [[[file], 0, true], [[file, join(dir, 'missing.md')], 2, false]]) {
    const result = spawnSync(process.execPath, [cli, '--json', ...files], { encoding: 'utf8', cwd: dir });
    assert.equal(result.status, status, result.stderr);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.equal(report.complete, complete);
    assert.equal(report.claims[0].reference, 'Tool#1');
    assert.equal(report.claims[0].kind, 'not checked');
  }
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--json/);
});
