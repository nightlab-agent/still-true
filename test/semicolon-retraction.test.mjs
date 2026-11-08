import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { run } from '../src/cli.mjs';
import { readState } from '../src/github.mjs';

const invoke = async (text, { strict = true, json = true } = {}) => {
  const output = [], reads = [];
  const code = await run(['note.md', '--repo', 'a/b', ...(strict ? ['--strict'] : []), ...(json ? ['--json'] : [])], {
    out: (line) => output.push(line), extract: extractClaims,
    readFile: async () => text, defaultRepo: null, env: {},
    read: (ref, options) => readState(ref, { ...options, fetchFn: async (request) => {
      assert.equal(request, `https://api.github.com/repos/a/b/issues/${ref.number}`);
      reads.push(ref.number);
      return new Response(JSON.stringify({
        state: 'closed', pull_request: { merged_at: '2026-11-07T12:00:00Z' },
        html_url: `https://github.com/a/b/pull/${ref.number}`,
      }), { status: 200 });
    } }),
  });
  return { code, output: output.join('\n'), reads };
};

test('review case 3: same-line semicolon retraction removes the stale contradiction', async () => {
  const note = '#12 is open; no longer true';
  const result = await invoke(note);
  // Retraction leaves no claim: strict must still report that nothing was verified.
  assert.equal(result.code, 3, result.output);
  assert.deepEqual(result.reads, []);
  const report = JSON.parse(result.output);
  assert.equal(report.complete, true);
  assert.equal(report.strict_failed, true);
  assert.deepEqual(report.counts, { checked: 0, contradicted: 0, looks: 0, notChecked: 0 });
  assert.deepEqual(report.claims, []);
  assert.deepEqual(report.unread_references, [{ file: 'note.md', line: 1, reference: 'a/b#12' }]);
  const plain = await invoke(note, { strict: false, json: false });
  assert.equal(plain.code, 0);
  assert.match(plain.output, /no claims about PR or issue state found/);
  assert.deepEqual(plain.reads, []);
});

test('control: affirmative claims still contradict and parenthetical retractions stay silent', async () => {
  const live = await invoke('#12 is open');
  assert.equal(live.code, 1);
  assert.deepEqual(live.reads, [12]);
  assert.equal(JSON.parse(live.output).counts.contradicted, 1);
  const parenthesis = await invoke('#12 is open (no longer true)');
  assert.equal(parenthesis.code, 3);
  assert.deepEqual(parenthesis.reads, []);
});

test('semicolon retractions use the existing standalone-field vocabulary', () => {
  for (const retraction of [
    'no longer true', 'not true', 'no longer the case', 'not the case',
    'no longer accurate', 'not accurate', 'no longer current', 'not current',
    'outdated', 'wrong', 'incorrect', 'which is wrong', 'not true anymore',
    'this is now incorrect!', 'NO LONGER TRUE.',
  ]) {
    assert.deepEqual(extractClaims(`#12 is open; ${retraction}`), [], retraction);
    assert.deepEqual(extractClaims(`#12 is open (${retraction})`), [], retraction);
  }
});

test('control: extra prose, quotes, code and sentence or line boundaries do not retract', () => {
  for (const tail of [
    '; fixes outdated documentation', '; wrong label fixed', '; no longer true for #13',
    '; "no longer true"', '; `no longer true`', '; stale',
    '. no longer true', '! no longer true',
    '; unrelated prose; no longer true',
    '\n\nno longer true',
  ]) assert.deepEqual(extractClaims(`#12 is open${tail}`).map((c) => [c.ref.number, c.said]), [[12, 'open']], tail);
});

test('a semicolon retraction removes only the immediately preceding clause', async () => {
  for (const [note, reference] of [
    ['#12 is open; no longer true; #13 is open', 'a/b#13'],
    ['#12 is open; #13 merged; no longer true', 'a/b#12'],
    ['#13 is open; #12 is open; no longer true', 'a/b#13'],
    ['#12 is open (no longer true); #13 is open', 'a/b#13'],
  ]) {
    const result = await invoke(note);
    assert.equal(result.code, 1, note);
    const report = JSON.parse(result.output);
    assert.equal(report.counts.contradicted, 1, note);
    assert.deepEqual(report.claims.map((c) => [c.reference, c.said, c.kind]), [[reference, 'open', 'contradiction']], note);
    assert.equal(result.reads.length, 1, note);
  }
  const independent = await invoke('#12 is open; #13 merged');
  assert.equal(independent.code, 1);
  assert.deepEqual(independent.reads, [12, 13]);
  assert.deepEqual(JSON.parse(independent.output).claims.map((c) => [c.reference, c.said]), [['a/b#12', 'open'], ['a/b#13', 'merged']]);
});

test('control: a retraction cannot suppress an unrelated contradiction', async () => {
  for (const note of [
    '#12 merged; no longer true; #13 is open',
    '#13 is open; #12 merged; no longer true',
  ]) {
    const result = await invoke(note);
    assert.equal(result.code, 1, note);
    const contradictions = JSON.parse(result.output).claims.filter((c) => c.kind === 'contradiction');
    assert.deepEqual(contradictions.map((c) => c.reference), ['a/b#13'], note);
  }
});

test('semicolon retractions give the same results on repeat and concurrent runs', async () => {
  const note = '#12 is open; no longer true; #13 merged';
  const first = await invoke(note);
  assert.equal(first.code, 0);
  assert.deepEqual(first.reads, [13]);
  assert.deepEqual(await invoke(note), first);
  const [again, live] = await Promise.all([invoke(note), invoke('#12 is open; #13 merged')]);
  assert.deepEqual(again, first);
  assert.equal(live.code, 1);
  assert.deepEqual(live.reads, [12, 13]);
});
