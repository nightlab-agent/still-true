// Review-only probes. Four assertions intentionally fail on the reviewed candidate.
// Run explicitly; these are outside the ordinary npm test glob.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { run } from '../../src/cli.mjs';
import { extractClaims } from '../../src/extract.mjs';

const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
const sample = readme.split('\n').find((line) => line.trimStart().startsWith("printf '")).trim();
async function scratch(t) {
  const dir = await mkdtemp('/tmp/still-true-newcomer-');
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function go(notes, flags = []) {
  const lines = [];
  const code = await run([...Object.keys(notes), '--repo', 'o/r', ...flags], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async (file) => {
      if (notes[file] instanceof Error) throw notes[file];
      return notes[file];
    },
    read: async () => ({ state: 'merged', kind: 'pull', url: 'u' }),
    defaultRepo: null, env: {},
  });
  return { code, lines };
}

test('F1: the README try-it command preserves an existing note', async (t) => {
  const dir = await scratch(t);
  await writeFile(`${dir}/note.md`, 'my existing work\n');
  spawnSync('bash', ['-c', sample], { cwd: dir });
  assert.equal(await readFile(`${dir}/note.md`, 'utf8'), 'my existing work\n');
});
test('F1 control: the same command creates the advertised sample in an empty folder', async (t) => {
  const dir = await scratch(t);
  const result = spawnSync('bash', ['-c', sample], { cwd: dir });
  assert.equal(result.status, 0);
  assert.equal(await readFile(`${dir}/note.md`, 'utf8'), '# Now\n\nhslee16/Archy#827 open\n');
});

test('F2: the skip explanation includes the first-level-title exception', async () => {
  assert.equal(extractClaims('# Project\n## Now\n#1 open').length, 1);
  const { lines } = await go({ 'n.md': '# Project\n## Now\n' });
  assert.match(lines[1], /first (?:level 1|level-1)|file(?:'s)? title/i);
});
test('F2 control: a non-title ancestor prevents reading the current section', async () => {
  const text = '## Project\n### Now\n#1 open';
  assert.deepEqual(extractClaims(text), []);
  assert.match((await go({ 'n.md': text })).lines[1], /and every heading above it/);
});

for (const folder of ['_npx', '_cacache']) {
  test(folder === '_npx' ? 'F3: the README cache-removal command removes the npx copy' : 'F3 control: the same command removes the content cache', async (t) => {
    const dir = await scratch(t);
    await writeFile(`${dir}/user.npmrc`, '');
    await writeFile(`${dir}/global.npmrc`, '');
    await mkdir(`${dir}/cache/${folder}/copy`, { recursive: true });
    const marker = `${dir}/cache/${folder}/copy/marker`;
    await writeFile(marker, 'disposable cached file');
    const result = spawnSync('npm', ['cache', 'clean', '--force'], {
      cwd: dir, encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: dir,
        npm_config_userconfig: `${dir}/user.npmrc`, npm_config_globalconfig: `${dir}/global.npmrc`,
        npm_config_cache: `${dir}/cache`, npm_config_offline: 'true' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await access(marker).then(() => true, () => false), false, `${folder} copy still exists`);
  });
}

test('F4: the README literal look suffix also describes a note with two looks', async () => {
  const suffix = /adds `([^`]+)` to the last line/.exec(readme)[1];
  const { lines } = await go({ 'n.md': '- waiting on #1\n- waiting on #2' });
  assert.ok(lines.at(-1).endsWith(suffix), lines.at(-1));
});
test('F4 control: the README literal suffix describes a note with one look', async () => {
  const suffix = /adds `([^`]+)` to the last line/.exec(readme)[1];
  assert.ok((await go({ 'n.md': 'waiting on #1' })).lines.at(-1).endsWith(suffix));
});

test('JSON paragraph: no claims in two readable files reports per-file skips and success', async () => {
  const { code, lines } = await go({ 'a.md': '## Next\n', 'b.md': '## Later\n' }, ['--json']);
  const report = JSON.parse(lines[0]);
  assert.equal(code, 0);
  assert.equal(report.complete, true);
  assert.equal(report.counts.checked, 0);
  assert.deepEqual(report.skipped_sections, ['a.md: Next', 'b.md: Later']);
});
test('JSON paragraph: an unreadable later file follows the documented failure exception', async () => {
  const { code, lines } = await go({ 'a.md': '## Next\n', 'b.md': new Error('ENOENT') }, ['--json']);
  const report = JSON.parse(lines[0]);
  assert.equal(code, 2);
  assert.equal(report.complete, false);
  assert.equal(report.counts.checked, 0);
  assert.equal('skipped_sections' in report, false);
});
test('JSON paragraph: one found but unresolved claim also suppresses skipped sections', async () => {
  const { code, lines } = await go({ 'a.md': '## Next\n', 'b.md': 'Unknown#1 open' }, ['--json']);
  const report = JSON.parse(lines[0]);
  assert.equal(code, 0);
  assert.equal(report.complete, true);
  assert.equal(report.counts.checked, 0);
  assert.equal(report.counts.notChecked, 1);
  assert.equal('skipped_sections' in report, false);
});
test('JSON paragraph: a checked claim suppresses skipped sections in either file order', async () => {
  for (const notes of [
    { 'a.md': '## Next\n', 'b.md': '#1 open' },
    { 'b.md': '#1 open', 'a.md': '## Next\n' },
  ]) {
    const { code, lines } = await go(notes, ['--json']);
    const report = JSON.parse(lines[0]);
    assert.equal(code, 1);
    assert.equal(report.counts.checked, 1);
    assert.equal('skipped_sections' in report, false);
  }
});
