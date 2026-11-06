import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const RULE = /every heading above it, apart from the file's title,/;

test('the try-it lines cannot overwrite a note.md already in the folder', async () => {
  const readme = await readFile('README.md', 'utf8');
  const printf = readme.split('\n').findIndex((line) => line.includes("printf '# Now"));
  assert.ok(printf > 0);
  assert.match(readme.split('\n')[printf - 1], /cd "\$\(mktemp -d\)"/);
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
