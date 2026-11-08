import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';
import { readState } from '../src/github.mjs';

const reported = 'Notes from today.\n#12 open';
const claim = (line) => ({ line, ref: { number: 12 }, said: 'open', quote: '#12 open' });

for (const [name, note, line] of [
  ['reported prose before', reported, 2],
  ['prose after', '#12 open\nNotes from today.', 1],
  ['prose on both sides', 'Notes from today.\n#12 open\nThat is all.', 2],
  ['prose without sentence punctuation', 'Notes from today\n#12 open\nThat is all', 2],
  ['source offsets and CRLF', '\r\n## Now\r\n\r\nNotes from today.\r\n#12 open\r\nThat is all.', 5],
  ['blank-line control before', 'Notes from today.\n\n#12 open', 3],
  ['blank-line control after', '#12 open\n\nNotes from today.', 1],
]) test(`adjacent prose: ${name}`, () => {
  const unread = [];
  assert.deepEqual(extractClaims(note, { unread }), [claim(line)]);
  assert.deepEqual(unread, []);
});

test('unparsed references beside a complete claim remain unread, with their own lines', () => {
  const unread = [];
  const note = 'see #13, merged 11-07\n#12 open\n#14 has been merged';
  assert.deepEqual(extractClaims(note, { unread }), [claim(2)]);
  assert.deepEqual(unread, [{ line: 1, ref: { number: 13 } }, { line: 3, ref: { number: 14 } }]);
  assert.deepEqual(extractClaims('Notes from today.\nsee #12 open\nThat is all.'), []);
  assert.deepEqual(extractClaims('Notes from today.\n#12 is\nopen'), []);
});

test('existing state, wait and queued forms survive unrelated adjacent prose', () => {
  for (const [form, said] of [
    ['#12 open', 'open'], ['#12 closed', 'closed'],
    ['only #12 (merged 11-07, known)', 'merged'], ['#12, merged 11-07', 'merged'],
    ['Waiting on #12.', 'waiting'], ['#12 owes one review', 'queued'],
  ]) assert.deepEqual(extractClaims(`Notes from today.\n${form}\nThat is all.`), [
    { line: 2, ref: { number: 12 }, said, quote: form },
  ], form);
});

test('wrapped qualifiers, negation, retractions and scope labels still suppress claims', () => {
  for (const prose of [
    'If the tests pass,', 'if the tests pass.', 'maybe once CI passes.',
    'Yesterday:', 'Old note:', 'Planned:', 'Log:', '**Log:**', 'not', 'not open',
    'Yesterday we wrote', 'The previous note said', 'It was open then',
    'no longer true', '(which is wrong)', 'into my local branch.',
    'and has a long tail', '  follow-up details', '?',
  ]) {
    assert.deepEqual(extractClaims(`${prose}\n#12 open`), [], prose);
    assert.deepEqual(extractClaims(`#12 open\n${prose}`), [], prose);
  }
  for (const form of ['#12 open (no longer true)', '#12 open, which is wrong', '#12 open; no longer true']) {
    assert.deepEqual(extractClaims(`Notes from today.\n${form}\nThat is all.`), [], form);
  }
  assert.deepEqual(extractClaims('Old note:\nNotes from today.\n- #12 open\n- #13 open'), []);
  assert.deepEqual(extractClaims('- Planned:\n  Notes from today.\n  - #12 open'), []);
});

test('Markdown exclusions still apply beside ordinary prose', () => {
  for (const note of [
    '## History\nNotes from today.\n#12 open',
    'Notes from today.\n#12 open\n---',
    'Notes from today.\n```md\n#12 open\n```',
    'Notes from today.\n    #12 open',
    'Notes from today.\n> context\n#12 open',
    'They wrote "\n#12 open\n"',
    '<!--\n#12 open\n-->',
  ]) assert.deepEqual(extractClaims(note), [], note);
});

const invoke = async (text, state = 'merged', json = true) => {
  const output = [], reads = [];
  const code = await run(['note.md', '--repo', 'a/b', '--strict', ...(json ? ['--json'] : [])], {
    out: (line) => output.push(line), extract: extractClaims,
    readFile: async () => text, defaultRepo: null, env: {},
    read: (ref, options) => readState(ref, { ...options, fetchFn: async (request) => {
      reads.push(request);
      assert.equal(request, 'https://api.github.com/repos/a/b/issues/12');
      return new Response(JSON.stringify({
        state: state === 'merged' ? 'closed' : state,
        pull_request: { merged_at: state === 'merged' ? '2026-11-07T12:00:00Z' : null },
        html_url: 'https://github.com/a/b/pull/12',
      }), { status: 200 });
    } }),
  });
  return { code, output: output.join('\n'), reads };
};

test('CLI checks the adjacent claim and its contradiction sets exit 1 in text and JSON', async () => {
  for (const [note, line] of [[reported, 2], ['#12 open\nNotes from today.', 1], ['Notes from today.\n\n#12 open', 3]]) {
    const result = await invoke(note);
    assert.equal(result.code, 1, result.output);
    assert.equal(result.reads.length, 1);
    const report = JSON.parse(result.output);
    assert.equal(report.complete, true);
    assert.deepEqual(report.counts, { checked: 1, contradicted: 1, looks: 0, notChecked: 0 });
    assert.deepEqual(report.claims, [{
      file: 'note.md', line, reference: 'a/b#12', said: 'open', actual: 'merged',
      kind: 'contradiction', url: 'https://github.com/a/b/pull/12',
    }]);
    assert.equal('unread_references' in report, false);
    const plain = await invoke(note, 'merged', false);
    assert.equal(plain.code, 1);
    assert.match(plain.output, new RegExp(`note\\.md:${line}  said open, but a/b#12 is merged`));
    assert.match(plain.output, /1 claim checked, 1 contradicted$/);
  }
});

test('adjacent claims are stable on repeated and overlapping CLI runs', async () => {
  const first = await invoke(reported);
  assert.equal(first.code, 1);
  assert.deepEqual(await invoke(reported), first);
  const [merged, open] = await Promise.all([invoke(reported), invoke(reported, 'open')]);
  assert.deepEqual(merged, first);
  assert.equal(open.code, 0);
  assert.equal(open.reads.length, 1);
  assert.equal(JSON.parse(open.output).claims[0].actual, 'open');
});

test('the executable checks the exact two-line note with a configured repository', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'still-true-prose-'));
  try {
    const file = join(dir, 'note.md'), preload = join(dir, 'transport.mjs');
    await writeFile(file, reported);
    await writeFile(preload, `globalThis.fetch = async (url) => {
      if (url !== 'https://api.github.com/repos/a/b/issues/12') throw new Error('unexpected URL');
      return new Response(JSON.stringify({ state: 'closed', pull_request: { merged_at: '2026-11-07T12:00:00Z' }, html_url: 'https://github.com/a/b/pull/12' }), { status: 200 });
    };\n`);
    const cli = fileURLToPath(new URL('../bin/still-true.js', import.meta.url));
    const result = spawnSync(process.execPath, ['--import', preload, cli, file, '--repo', 'a/b'], {
      cwd: dir, encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH },
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /note\.md:2  said open, but a\/b#12 is merged/);
    assert.match(result.stdout, /1 claim checked, 1 contradicted\n$/);
    assert.equal(await readFile(file, 'utf8'), reported);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
