// Dex's release review: each fault beside a passing control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run, repoFromRemote } from '../src/cli.mjs';
import { resolveRef } from '../src/github.mjs';

const merged = { state: 'merged', kind: 'pull', at: null, url: 'u' };
const invoke = async (argv, overrides = {}) => {
  const lines = [];
  const code = await run(argv, {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => '#1 open', read: async () => merged,
    defaultRepo: null, env: {}, ...overrides,
  });
  return { code, lines };
};

test('F1: an old-note label applies to the second list entry too', () => {
  assert.deepEqual(extractClaims('Old note:\n- #1 open\n- #2 open'), []);
});
test('F1 control: independent present list entries are both claims', () => {
  assert.deepEqual(extractClaims('- #1 open\n- #2 open').map((c) => c.ref.number), [1, 2]);
});

test('F2: constructor is an unresolved repository name, not an inherited alias', () => {
  assert.equal(resolveRef({ repo: 'constructor', number: 1 }), null);
});
test('F2 control: an ordinary unresolved repository name returns null', () => {
  assert.equal(resolveRef({ repo: 'Tool', number: 1 }), null);
});

test('F3: an unreadable later file preserves contradiction exit 1 and marks incompleteness', async () => {
  const { code, lines } = await invoke(['n.md', 'missing.md', '--repo', 'a/b'], {
    readFile: async (file) => {
      if (file === 'missing.md') throw new Error('ENOENT');
      return '#1 open';
    },
  });
  assert.deepEqual({ code, incomplete: lines.some((line) => /not complete/.test(line)) },
    { code: 1, incomplete: true });
});
test('F3 control: a later GitHub failure preserves contradiction exit 1 and marks incompleteness', async () => {
  const { code, lines } = await invoke(['n.md', '--repo', 'a/b'], {
    readFile: async () => '- #1 open\n- #2 open',
    read: async ({ number }) => {
      if (number === 2) throw new Error('fetch failed');
      return merged;
    },
  });
  assert.deepEqual({ code, incomplete: lines.some((line) => /not complete/.test(line)) },
    { code: 1, incomplete: true });
});

for (const args of [['--repo'], ['--alias'], ['--alias', 'Tool'], ['--repo', 'owner']]) {
  test(`F4: bad usage ${args.join(' ')} returns 2 before reading`, async () => {
    let reads = 0;
    const { code } = await invoke(['n.md', ...args], {
      readFile: async () => { reads++; return ''; },
    });
    assert.deepEqual({ code, reads }, { code: 2, reads: 0 });
  });
}
test('F4 control: a valid explicit repo checks the claim', async () => {
  const { code, lines } = await invoke(['n.md', '--repo', 'a/b']);
  assert.equal(code, 1);
  assert.equal(lines.at(-1), '1 claim checked, 1 contradicted');
});

test('F5: a different origin hostname cannot select a GitHub repository', () => {
  assert.equal(repoFromRemote('https://notgithub.com/a/b.git'), null);
});
test('F5 control: a GitHub origin selects its repository', () => {
  assert.equal(repoFromRemote('https://github.com/a/b.git'), 'a/b');
});
test('F5: every usual form of a GitHub origin selects its repository', () => {
  for (const u of ['git@github.com:a/b.git', 'ssh://git@github.com/a/b.git', 'https://github.com/a/b', 'https://x@github.com/a/b.git\n']) {
    assert.equal(repoFromRemote(u), 'a/b', u);
  }
});
test('F5: look-alike hosts and paths select nothing', () => {
  for (const u of ['https://github.com.example.org/a/b', 'git@notgithub.com:a/b.git', 'https://example.org/github.com/a/b']) {
    assert.equal(repoFromRemote(u), null, u);
  }
});

test('F6: text before the first heading is read, as the README says', () => {
  assert.equal(extractClaims('#1 open\n\n## History').length, 1);
});
test('F6 control: a claim inside History stays silent', () => {
  assert.deepEqual(extractClaims('## History\n\n#1 open'), []);
});

test('repeat and overlap: run-local caches do not leak state between invocations', async () => {
  const once = await invoke(['n.md', '--repo', 'a/b']);
  const again = await invoke(['n.md', '--repo', 'a/b']);
  assert.deepEqual(once, again);
  const [closedRun, openRun] = await Promise.all([
    invoke(['n.md', '--repo', 'a/b']),
    invoke(['n.md', '--repo', 'a/b'], {
      read: async () => ({ state: 'open', kind: 'pull', at: null, url: 'u' }),
    }),
  ]);
  assert.equal(closedRun.code, 1);
  assert.equal(openRun.code, 0);
});
