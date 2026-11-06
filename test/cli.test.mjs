import test from 'node:test';
import assert from 'node:assert/strict';
import { run, repoFromRemote, parseArgs } from '../src/cli.mjs';

const claims = (list) => () => list;
const c = (line, ref, said) => ({ line, ref, said, quote: `q${line}` });
const io = () => { const o = []; return { out: (s) => o.push(s), o }; };
const base = { readFile: async () => 'note', token: undefined, defaultRepo: null };

test('a contradiction prints file:line and the real state, exit 1', async () => {
  const { out, o } = io();
  const code = await run(['h.md', '--repo', 'a/b'], { ...base, out, extract: claims([c(3, { number: 12 }, 'open')]),
    read: async () => ({ state: 'merged', kind: 'pull', at: '2026-11-05T19:19:00Z', url: 'https://x/12' }) });
  assert.equal(code, 1);
  assert.match(o.join('\n'), /h\.md:3/);
  assert.match(o.join('\n'), /said open/);
  assert.match(o.join('\n'), /merged 2026-11-05/);
  assert.match(o.join('\n'), /q3/);
});
test('all true: exit 0 and the count says what was checked', async () => {
  const { out, o } = io();
  const code = await run(['h.md', '--repo', 'a/b'], { ...base, out, extract: claims([c(3, { number: 12 }, 'open')]),
    read: async () => ({ state: 'open', kind: 'pull', at: null, url: 'u' }) });
  assert.equal(code, 0);
  assert.match(o.join('\n'), /1 claim checked, 0 contradicted/);
});
test('no claims found says so: a clean run must not look like a checked one', async () => {
  const { out, o } = io();
  assert.equal(await run(['h.md'], { ...base, out, extract: claims([]), read: async () => null }), 0);
  assert.match(o.join('\n'), /no claims/i);
});
test('a ref it cannot place is reported as not checked, with its line', async () => {
  const { out, o } = io();
  const code = await run(['h.md'], { ...base, out, extract: claims([c(4, { repo: 'Archy', number: 8 }, 'open')]), read: async () => assert.fail('no request') });
  assert.equal(code, 0);
  assert.match(o.join('\n'), /not checked/);
  assert.match(o.join('\n'), /h\.md:4/);
  assert.match(o.join('\n'), /--alias Archy=owner\/name/);
});
test('the same ref twice costs one request', async () => {
  const { out } = io(); let n = 0;
  await run(['h.md', '--repo', 'a/b'], { ...base, out, extract: claims([c(1, { number: 12 }, 'open'), c(2, { number: 12 }, 'open')]),
    read: async () => { n++; return { state: 'open', kind: 'pull', at: null, url: 'u' }; } });
  assert.equal(n, 1);
});
test('a read failure stops with exit 2 and never reads as clean', async () => {
  const { out, o } = io();
  const code = await run(['h.md', '--repo', 'a/b'], { ...base, out, extract: claims([c(1, { number: 12 }, 'open')]),
    read: async () => { throw new Error('GitHub answered 403 for a/b#12: API rate limit exceeded'); } });
  assert.equal(code, 2);
  assert.match(o.join('\n'), /rate limit/);
  assert.doesNotMatch(o.join('\n'), /0 contradicted/);
});
test('a contradiction found before a read failure still exits 1 and prints', async () => {
  const { out, o } = io(); let n = 0;
  const code = await run(['h.md', '--repo', 'a/b'], { ...base, out, extract: claims([c(1, { number: 1 }, 'open'), c(2, { number: 2 }, 'open')]),
    read: async () => { if (n++) throw new Error('GitHub answered 403 for a/b#2: API rate limit exceeded'); return { state: 'merged', kind: 'pull', at: '2026-11-05T19:19:00Z', url: 'u' }; } });
  assert.equal(code, 1);
  assert.match(o.join('\n'), /h\.md:1/);
  assert.match(o.join('\n'), /rate limit/);
});
test('an unreadable file exits 2', async () => {
  const { out } = io();
  assert.equal(await run(['nope.md'], { ...base, out, extract: claims([]), readFile: async () => { throw new Error('ENOENT'); } }), 2);
});
test('no file named exits 2 with usage', async () => {
  const { out, o } = io();
  assert.equal(await run([], { ...base, out, extract: claims([]) }), 2);
  assert.match(o.join('\n'), /usage/i);
});
test('--alias repeats and --repo overrides the remote', () => {
  const a = parseArgs(['n.md', '--alias', 'Archy=h/Archy', '--alias', 'x=y/x', '--repo', 'a/b']);
  assert.deepEqual(a.files, ['n.md']);
  assert.deepEqual(a.aliases, { Archy: 'h/Archy', x: 'y/x' });
  assert.equal(a.repo, 'a/b');
});
test('repoFromRemote reads https and ssh forms', () => {
  assert.equal(repoFromRemote('https://github.com/a/b.git\n'), 'a/b');
  assert.equal(repoFromRemote('git@github.com:a/b.git'), 'a/b');
  assert.equal(repoFromRemote('https://github.com/a/b'), 'a/b');
  assert.equal(repoFromRemote('https://gitlab.com/a/b.git'), null);
});

test('a stale wait prints a look line and does not fail the run', async () => {
  const lines = [];
  const rc = await run(['n.md', '--repo', 'a/b'], {
    out: (l) => lines.push(l),
    extract: () => [{ line: 2, ref: { number: 12 }, said: 'waiting', quote: 'waits on #12' }],
    readFile: async () => 'x',
    read: async () => ({ state: 'merged', kind: 'pull', at: '2026-11-05T19:19:00Z', url: 'u' }),
    token: null,
  });
  assert.equal(rc, 0);
  assert.match(lines[0], /^n\.md:2  look: waits on a\/b#12, which is merged 2026-11-05  u$/);
  assert.match(lines.at(-1), /1 claim checked, 0 contradicted, 1 to look at/);
});

test('a failed read behind a proxy says how to reach GitHub through it', async () => {
  const lines = [];
  const rc = await run(['n.md', '--repo', 'a/b'], {
    out: (l) => lines.push(l),
    extract: () => [{ line: 1, ref: { number: 12 }, said: 'open', quote: 'x' }],
    readFile: async () => 'x',
    read: async () => { throw new Error('fetch failed'); },
    token: null,
    env: { HTTPS_PROXY: 'http://proxy:1' },
  });
  assert.equal(rc, 2);
  assert.match(lines.join('\n'), /NODE_USE_ENV_PROXY=1/);
});
test('with no proxy set, no proxy hint', async () => {
  const lines = [];
  await run(['n.md', '--repo', 'a/b'], {
    out: (l) => lines.push(l),
    extract: () => [{ line: 1, ref: { number: 12 }, said: 'open', quote: 'x' }],
    readFile: async () => 'x',
    read: async () => { throw new Error('fetch failed'); },
    token: null,
    env: {},
  });
  assert.doesNotMatch(lines.join('\n'), /PROXY/);
});

test('--help prints the usage and an unknown flag is refused, never read as a file', async () => {
  const run1 = async (argv) => { const lines = []; const rc = await run(argv, { out: (l) => lines.push(l), extract: () => [], readFile: async () => { throw new Error('read'); }, read: async () => null, token: null }); return { rc, lines }; };
  const help = await run1(['--help']);
  assert.equal(help.rc, 0);
  assert.match(help.lines[0], /^usage: /);
  const odd = await run1(['--nope', 'n.md']);
  assert.equal(odd.rc, 2);
  assert.match(odd.lines.join('\n'), /unknown option --nope/);
});
