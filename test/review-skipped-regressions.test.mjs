// The skipped-section review regressions, each beside a passing control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';

async function go(text, ...flags) {
  const lines = [];
  const code = await run(['note.md', '--repo', 'o/r', ...flags], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async () => text,
    read: async () => { throw new Error('a skipped or quoted claim must not be read'); },
    defaultRepo: null, env: {},
  });
  return { code, lines };
}

test('a multiline setext heading reports its whole name', async () => {
  const text = 'Next\nsteps\n----\n\n#1 open\n';
  const result = await go(text, '--json');
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.lines.join('')).skipped_sections, ['Next steps']);
  assert.deepEqual((await go(text)).lines, [
    'no claims about PR or issue state found',
    'skipped 1 section: Next steps. A section is read only if its heading, and every heading above it, apart from the file\'s title, starts with Now, Handoff, State, Status or Current.',
  ]);
});
test('control: a single-line setext heading reports its name', async () => {
  const result = await go('Next steps\n----\n\n#1 open\n', '--json');
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.lines.join('')).skipped_sections, ['Next steps']);
});

test('a fenced example inside a multiline quotation adds no skipped section', async () => {
  const text = 'They wrote "\n\n```md\n## Next\n#1 open\n```\n\n"\n';
  const result = await go(text, '--json');
  assert.equal(result.code, 0);
  assert.equal('skipped_sections' in JSON.parse(result.lines.join('')), false);
  assert.deepEqual((await go(text)).lines, ['no claims about PR or issue state found']);
});
test('control: a fenced example outside a quotation adds no skipped section', async () => {
  const result = await go('```md\n## Next\n#1 open\n```\n', '--json');
  assert.equal(result.code, 0);
  assert.equal('skipped_sections' in JSON.parse(result.lines.join('')), false);
});

test('a multiline current heading keeps its conservative extraction behavior', () => {
  const skipped = [];
  assert.deepEqual(extractClaims('Now\nwith plans\n----\n\n#1 open\n', { skipped }), []);
  assert.deepEqual(skipped, ['Now with plans']);
});
test('unfenced headings inside quotations still prevent a read into history', () => {
  for (const heading of ['## History', 'History\n-------']) {
    const skipped = [];
    const text = `## Now\n\nThey wrote "\n\n~~~md\n## Next\n"\n~~~\n\n${heading}\n\n"\n\n#1 open\n`;
    assert.deepEqual(extractClaims(text, { skipped }), [], heading);
    assert.deepEqual(skipped, ['History'], heading);
  }
});

async function files(notes, flags) {
  const lines = [];
  const code = await run([...Object.keys(notes), '--repo', 'o/r', ...flags], {
    out: (line) => lines.push(line), extract: extractClaims,
    readFile: async (file) => notes[file],
    read: async () => ({ state: 'open', kind: 'pull', url: 'u' }),
    defaultRepo: null, env: {},
  });
  return { code, lines };
}
test('mixed files report no skipped sections when any file supplies a claim', async () => {
  for (const names of [['next.md', 'now.md'], ['now.md', 'next.md']]) {
    const notes = { 'next.md': '## Next\n\n#1 open\n', 'now.md': '## Now\n\n#2 open\n' };
    const ordered = Object.fromEntries(names.map((name) => [name, notes[name]]));
    const plain = await files(ordered, []);
    assert.equal(plain.code, 0);
    assert.deepEqual(plain.lines, ['1 claim checked, 0 contradicted']);
    const json = await files(ordered, ['--json']);
    assert.equal(json.code, 0);
    const report = JSON.parse(json.lines.join(''));
    assert.equal(report.claims.length, 1);
    assert.equal(report.claims[0].file, 'now.md');
    assert.equal('skipped_sections' in report, false);
  }
});
test('control: files with no claims aggregate their skipped sections, each with its file', async () => {
  const notes = { 'next.md': '## Next\n\n#1 open\n', 'later.md': '## Later\n\n#2 open\n' };
  const plain = await files(notes, []);
  assert.equal(plain.code, 0);
  assert.match(plain.lines[1], /^skipped 2 sections: next\.md: Next, later\.md: Later\./);
  const json = await files(notes, ['--json']);
  assert.equal(json.code, 0);
  assert.deepEqual(JSON.parse(json.lines.join('')).skipped_sections, ['next.md: Next', 'later.md: Later']);
});
