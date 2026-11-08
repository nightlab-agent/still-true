import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.mjs';
import { extractClaims } from '../src/extract.mjs';
import { readState, resolveRef } from '../src/github.mjs';

const invoke = async (text, args, json = true) => {
  const output = [], requests = [];
  const code = await run(['note.md', ...args, '--strict', ...(json ? ['--json'] : [])], {
    out: (line) => output.push(line), extract: extractClaims,
    readFile: async () => text, defaultRepo: null, env: {},
    read: (ref, options) => readState(ref, { ...options, fetchFn: async (url) => {
      requests.push(url);
      return new Response(JSON.stringify({
        state: 'closed', pull_request: { merged_at: '2026-11-05T00:00:00Z' },
        html_url: 'https://github.com/o/archy/pull/827',
      }), { status: 200 });
    } }),
  });
  return { code, output: output.join('\n'), requests };
};

for (const [label, args, target] of [
  ['default repo', ['--repo', 'o/archy'], 'o/archy'],
  ['mixed-case default repo', ['--repo', 'O/Archy'], 'O/Archy'],
  ['alias', ['--alias', 'archy=O/Target'], 'O/Target'],
  ['mixed-case alias', ['--alias', 'Archy=O/Target'], 'O/Target'],
]) test(`short names match without case changes to the resolved ${label}`, async () => {
  for (const spelling of ['archy', 'Archy', 'ARCHY']) {
    const result = await invoke(`${spelling}#827 open`, args);
    assert.equal(result.code, 1, `${spelling}: ${result.output}`);
    assert.deepEqual(result.requests, [`https://api.github.com/repos/${target}/issues/827`]);
    const report = JSON.parse(result.output);
    assert.equal(report.complete, true);
    assert.deepEqual(report.counts, { checked: 1, contradicted: 1, looks: 0, notChecked: 0 });
    assert.deepEqual(report.claims, [{
      file: 'note.md', line: 1, reference: `${target}#827`, said: 'open', actual: 'merged',
      kind: 'contradiction', url: 'https://github.com/o/archy/pull/827',
    }]);
    const plain = await invoke(`${spelling}#827 open`, args, false);
    assert.equal(plain.code, 1);
    assert.equal(plain.output, `note.md:1  said open, but ${target}#827 is merged 2026-11-05  https://github.com/o/archy/pull/827\n  "${spelling}#827 open"\n1 claim checked, 1 contradicted`);
  }
});

test('case variants share a read without hiding either claim', async () => {
  const result = await invoke('Archy#827 open\n\narchy#827 open', ['--repo', 'o/archy']);
  assert.equal(result.code, 1);
  assert.equal(result.requests.length, 1);
  assert.deepEqual(JSON.parse(result.output).counts, { checked: 2, contradicted: 2, looks: 0, notChecked: 0 });
});

test('unrelated short names stay unresolved through repo and alias options', async () => {
  for (const args of [['--repo', 'o/archy'], ['--alias', 'archy=o/archy']]) {
    for (const spelling of ['Other', 'ArchyExtra']) {
      const result = await invoke(`${spelling}#827 open`, args);
      assert.equal(result.code, 3);
      assert.deepEqual(result.requests, []);
      const report = JSON.parse(result.output);
      assert.equal(report.claims[0].reference, `${spelling}#827`);
      assert.equal(report.claims[0].kind, 'not checked');
    }
  }
});

test('other full references never disambiguate a short name', async () => {
  const result = await invoke('a/Archy#827 open\n\nb/Archy#827 open\n\nArchy#827 open', []);
  assert.equal(result.code, 1);
  assert.equal(result.requests.length, 2);
  assert.deepEqual(JSON.parse(result.output).counts, { checked: 2, contradicted: 2, looks: 0, notChecked: 1 });
});

test('explicit aliases still override the default repo and exact alias keys still win', () => {
  const options = { defaultRepo: 'o/archy', aliases: { Archy: 'A/Target', archy: 'B/Other' } };
  assert.deepEqual(resolveRef({ repo: 'Archy', number: 827 }, options), { owner: 'A', repo: 'Target', number: 827 });
  assert.deepEqual(resolveRef({ repo: 'archy', number: 827 }, options), { owner: 'B', repo: 'Other', number: 827 });
});

test('conflicting aliases cannot supply a new case-insensitive match, even with a matching default', async () => {
  const result = await invoke('ARCHY#827 open', ['--repo', 'o/archy', '--alias', 'Archy=a/one', '--alias', 'archy=b/two']);
  assert.equal(result.code, 3);
  assert.deepEqual(result.requests, []);
});

test('case-variant aliases for the same repository keep their configured spelling', () => {
  const options = { aliases: { Archy: 'O/Target', archy: 'o/target' } };
  assert.deepEqual(resolveRef({ repo: 'ARCHY', number: 827 }, options), { owner: 'O', repo: 'Target', number: 827 });
  assert.deepEqual(options, { aliases: { Archy: 'O/Target', archy: 'o/target' } });
});

test('inherited alias keys remain unavailable regardless of case', () => {
  const options = { aliases: Object.create({ Archy: 'o/archy' }) };
  assert.equal(resolveRef({ repo: 'archy', number: 827 }, options), null);
  assert.equal(resolveRef({ repo: 'CONSTRUCTOR', number: 827 }), null);
});
