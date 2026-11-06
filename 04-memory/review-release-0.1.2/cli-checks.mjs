// Actual executable and real Markdown files; only GitHub transport is synthetic.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../bin/still-true.js', import.meta.url));
const dir = await mkdtemp(new URL('./scratch-', import.meta.url));
try {
  const preload = `${dir}/transport.mjs`;
  await writeFile(preload, `globalThis.fetch = async (url) => {
    if (url !== 'https://api.github.com/repos/a/b/issues/1') throw new Error('unexpected URL');
    const merged = process.env.REVIEW_STATE === 'merged';
    return new Response(JSON.stringify({
      state: merged ? 'closed' : 'open',
      ...(merged ? { pull_request: { merged_at: '2026-11-05T00:00:00Z' } } : { pull_request: {} }),
      html_url: 'https://github.com/a/b/pull/1',
    }), { status: 200 });
  };\n`);
  const cases = [
    ['F1', '#1 merged, maybe once CI passes.\n', 'open', 1],
    ['F1 control', '#1 merged, once CI passes.\n', 'open', 0],
    ['F2', 'Old note:\n> context\n- #1 open\n', 'merged', 1],
    ['F2 control', 'Old note:\n- #1 open\n', 'merged', 0],
  ];
  for (const [label, note, state, status] of cases) {
    const file = `${dir}/note.md`;
    await writeFile(file, note);
    for (const json of [false, true]) {
      const result = spawnSync(process.execPath, [
        '--import', preload, cli, file, '--repo', 'a/b', ...(json ? ['--json'] : []),
      ], {
        cwd: dir, encoding: 'utf8', timeout: 5000,
        env: { PATH: process.env.PATH, REVIEW_STATE: state },
      });
      assert.equal(result.status, status, result.stderr);
      assert.equal(result.stderr, '');
      if (json) {
        const report = JSON.parse(result.stdout);
        assert.equal(report.complete, true);
        assert.equal(report.counts.contradicted, status);
      } else if (status) assert.match(result.stdout, /said .*but/);
      else assert.equal(result.stdout, 'no claims about PR or issue state found\n');
      console.log(`${label} (${json ? 'JSON' : 'text'}): exit ${result.status}`);
      console.log(result.stdout.trim());
    }
    assert.equal(await readFile(file, 'utf8'), note);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
