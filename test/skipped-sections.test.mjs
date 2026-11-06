import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';

const exec = async (text, ...flags) => {
  const lines = [];
  const code = await run(['n.md', '--repo', 'o/r', ...flags], { out: (l) => lines.push(l), extract: extractClaims, readFile: async () => text, read: async () => ({ state: 'open', kind: 'pull', url: 'u' }) });
  return { code, lines };
};

test('a note whose claims sit under a heading it skips says so', async () => {
  const { code, lines } = await exec('## Next\n- #1 is open\n\n## Later\n- #2 is open\n');
  assert.equal(code, 0);
  assert.equal(lines[0], 'no claims about PR or issue state found');
  assert.match(lines[1], /skipped 2 sections: Next, Later/);
  assert.match(lines[1], /Now, Handoff, State, Status or Current/);
});
test('--json names the skipped sections', async () => {
  const { lines } = await exec('## Next\n- #1 is open\n', '--json');
  assert.deepEqual(JSON.parse(lines.join('')).skipped_sections, ['Next']);
});
test('a note with nothing skipped keeps its one line', async () => {
  assert.deepEqual((await exec('# Status\nAll quiet.\n')).lines, ['no claims about PR or issue state found']);
  assert.deepEqual((await exec('All quiet.\n')).lines, ['no claims about PR or issue state found']);
});
test('--json with nothing skipped has no new key', async () => {
  assert.equal('skipped_sections' in JSON.parse((await exec('All quiet.\n', '--json')).lines.join('')), false);
});
test('a found claim prints no skipped line', async () => {
  const { lines } = await exec('# Now\n- #1 is open\n\n# Plan\n- #2 is open\n');
  assert.equal(lines.some((l) => /skipped/.test(l)), false);
});
test('a readable section under the file title is not called skipped', async () => {
  const { lines } = await exec('# Project\n## Now\nAll quiet.\n## Next\n- #1 is open\n');
  assert.match(lines[1], /skipped 2 sections: Project, Next\./);
});
