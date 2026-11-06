import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RULE = /every heading above it, apart from the file's title,/;

function tryItLine(readme) {
  const line = readme.split('\n').find((l) => l.includes("printf '# Now"));
  assert.ok(line);
  return line.trim();
}

for (const shell of ['sh', 'bash']) {
  test(`${shell}: the try-it line cannot overwrite a note.md, even when the temporary folder cannot be made`, async () => {
    const line = tryItLine(await readFile('README.md', 'utf8'));
    const home = await mkdtemp(join(tmpdir(), 'st-tryit-'));
    await writeFile(join(home, 'note.md'), 'my existing work');
    spawnSync(shell, ['-c', line], { cwd: home, env: { ...process.env, TMPDIR: join(home, 'missing') } });
    assert.equal(await readFile(join(home, 'note.md'), 'utf8'), 'my existing work');
  });
}

test('the try-it line still writes the sample into a new folder', async () => {
  const line = tryItLine(await readFile('README.md', 'utf8'));
  const home = await mkdtemp(join(tmpdir(), 'st-tryit-'));
  await writeFile(join(home, 'note.md'), 'my existing work');
  const out = spawnSync('sh', ['-c', `${line} && pwd && cat note.md`], { cwd: home, encoding: 'utf8', env: { ...process.env, TMPDIR: home } });
  assert.equal(out.status, 0);
  assert.notEqual(out.stdout.split('\n')[0], home);
  assert.match(out.stdout, /hslee16\/Archy#827 open/);
  assert.equal(await readFile(join(home, 'note.md'), 'utf8'), 'my existing work');
});

test('the skip rule names the title exception, in the line and the changelog', async () => {
  assert.match(await readFile('CHANGELOG.md', 'utf8'), /every heading above it, apart from the file's title,/);
  const src = await readFile('src/cli.mjs', 'utf8');
  assert.match(src, RULE);
});

test('the README promises no cache command that leaves the copy behind', async () => {
  const readme = await readFile('README.md', 'utf8');
  assert.doesNotMatch(readme, /npm cache clean/);
  assert.match(readme, /~\/\.npm\/_npx/);
});

test('the look suffix sentence is about one look', async () => {
  assert.match(await readFile('README.md', 'utf8'), /With one thing to look at, the last line gains `, 1 to look at`\./);
});
