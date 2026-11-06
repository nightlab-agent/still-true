import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';

test('F1: uncertainty in the same once field must stay uncertain', () => {
  assert.deepEqual(extractClaims('#1 merged, maybe once CI passes.'), []);
});

test('F1 control: a later thank-you step preserves the current state', () => {
  assert.deepEqual(
    extractClaims('#1 merged, thank once on merge.').map(({ said }) => said),
    ['merged'],
  );
});

test('F2: a blockquote must not end an Old note scope', () => {
  assert.deepEqual(extractClaims('Old note:\n> context\n- #1 open'), []);
});

test('F2 control: a blockquote without a historical label preserves the next item', () => {
  assert.deepEqual(
    extractClaims('> context\n- #1 open').map(({ said }) => said),
    ['open'],
  );
});

test('F1 neighbours: later once fields retain the other uncertainty words', () => {
  for (const word of [
    'probably', 'might', 'should', 'could', 'would', 'if', 'unless', 'when',
    'until', 'need', 'get', 'think', 'believe', 'locally', 'reopened', 're-opened',
    "isn't", 'isn’t', 'by Friday',
  ]) {
    for (const field of [`${word} once CI passes`, `thank once ${word} CI passes`]) {
      const note = `#1 merged, ${field}.`;
      assert.deepEqual(extractClaims(note), [], note);
    }
  }
  assert.deepEqual(extractClaims('#1 merged, if CI passes once today.'), []);
});

test('F2 neighbours: nested quotes preserve history and independent controls', () => {
  for (const quote of ['> > context', '- - > context']) {
    assert.deepEqual(extractClaims(`Old note:\n${quote}\n- #1 open`), [], quote);
    const note = `${quote}\n- #1 open`;
    assert.deepEqual(extractClaims(note), [{
      line: note.split('\n').length, ref: { number: 1 }, said: 'open', quote: '#1 open',
    }], quote);
  }
});

test('F2 neighbours: lazy quote continuations retain history across multiple items', () => {
  for (const quote of ['> context\nlazy continuation', '> context\n> > nested\nlazy continuation']) {
    assert.deepEqual(extractClaims(`Old note:\n${quote}\n- #1 open\n- #2 open`), [], quote);
    assert.deepEqual(extractClaims(`${quote}\n\n- #1 open`).map(({ said }) => said), ['open'], quote);
  }
});

test('F2 scope still ends at a blank line or a new heading', () => {
  for (const boundary of ['\n', '## Now\n']) {
    const note = `Old note:\n> context\n${boundary}- #1 open`;
    assert.deepEqual(extractClaims(note).map(({ said }) => said), ['open'], note);
  }
});

test('F1 and F2 stay silent in text and JSON while their controls still contradict', async () => {
  for (const [note, state, expected] of [
    ['#1 merged, maybe once CI passes.', 'open', 0],
    ['#1 merged, thank once on merge.', 'open', 1],
    ['Old note:\n> context\n- #1 open', 'merged', 0],
    ['> context\n- #1 open', 'merged', 1],
  ]) {
    for (const json of [false, true]) {
      const lines = [];
      let reads = 0;
      const code = await run(['note.md', '--repo', 'a/b', ...(json ? ['--json'] : [])], {
        out: (line) => lines.push(line), extract: extractClaims,
        readFile: async () => note, defaultRepo: null, token: null, env: {},
        read: async () => {
          reads++;
          return { state, kind: 'pull', at: null, url: 'https://github.com/a/b/pull/1' };
        },
      });
      assert.equal(code, expected, note);
      assert.equal(reads, expected, note);
      if (json) {
        const report = JSON.parse(lines.join('\n'));
        assert.equal(report.complete, true);
        assert.equal(report.counts.checked, expected, note);
        assert.equal(report.counts.contradicted, expected, note);
      } else if (expected) assert.match(lines.join('\n'), /said .*but/);
      else assert.deepEqual(lines, ['no claims about PR or issue state found']);
    }
  }
});

test('every lazy line of a quote stays quoted, a list after it does not', () => {
  assert.deepEqual(extractClaims('Old note:\n> context\n#1 open\n#2 open'), []);
  assert.deepEqual(extractClaims('> context\n#1 open\n#2 open\n#3 open'), []);
  assert.deepEqual(extractClaims('> context\nlazy continuation\n- #1 open').map(({ said }) => said), ['open']);
  assert.deepEqual(extractClaims('> context\n\n#1 open').map(({ said }) => said), ['open']);
});
