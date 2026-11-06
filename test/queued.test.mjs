import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaims } from '../src/extract.mjs';
import { compare } from '../src/compare.mjs';
import { readState } from '../src/github.mjs';
import { run } from '../src/cli.mjs';

const subject = { repo: 'argent', number: 1768 };
const dependency = { repo: 'argent', number: 1762 };
const quote = 'argent#1768 81004b3 owes one critic and waits on argent#1762 and a slot.';
const real = { state: 'closed', kind: 'issue', state_reason: 'not_planned', at: '2026-11-06T10:00:00Z', url: 'u' };
const invoke = async (text, options = {}) => {
  const lines = [];
  const { json = false, read = async () => real } = options;
  const code = await run(['note.md', '--alias', 'argent=org/argent', ...(json ? ['--json'] : [])], {
    out: (line) => lines.push(line), extract: extractClaims, readFile: async () => text,
    read, defaultRepo: null, env: {},
  });
  return { code, lines, ...(json ? { report: JSON.parse(lines[0]) } : {}) };
};

test('queued work preserves both the subject and its dependency without inventing an open claim', () => {
  assert.deepEqual(extractClaims(quote), [
    { line: 1, ref: subject, said: 'queued', quote },
    { line: 1, ref: dependency, said: 'waiting', quote },
  ]);
});

test('a counted review obligation works without a hash, with a hash, and across one comma', () => {
  for (const text of [
    'argent#1768 owes a review.', 'PR argent#1768 still owes two critics.',
    'argent#1768 one review owed.',
    'argent#1768 abc123, one review owed, waits on argent#1762.',
    'argent#1768 81004b3 owes one critic and waits on argent#1762 and a slot.',
  ]) {
    const claims = extractClaims(text);
    assert.deepEqual(claims[0], { line: 1, ref: subject, said: 'queued', quote: text });
    assert.ok(claims.every((c) => c.said !== 'open'));
  }
});

test('historical wording, unrelated mentions, uncertainty and negation do not queue work', () => {
  for (const text of [
    'argent#1768 81004b3.', 'The fix was in argent#1768.',
    'Yesterday argent#1768 owed one critic.', 'argent#1768 owed one critic.',
    'argent#1768 had one review owed.', 'Previously: argent#1768 owes one critic.',
    'argent#1768 owes one critic, according to yesterday\'s note.',
    'argent#1768 owes one critic, not now.', 'argent#1768 owes no critics.',
    'argent#1768 no longer owes one critic.', 'argent#1768 owes one critic?',
    'If CI passes, argent#1768 owes one critic.',
    'argent#1768 owes one critic if CI passes.',
    'Review of argent#1768 owes one critic.', 'argent#1768 needs more work.',
    'argent#1768 owes one critic and argent#1762 is the old fix.',
    'argent#1768 owes one critic, closed yesterday.',
  ]) assert.ok(!extractClaims(text).some((c) => c.said === 'queued'), text);
});

test('queued work uses the existing Markdown and historical scope filters', () => {
  for (const text of [
    `"${quote}"`, `> ${quote}`, `\`${quote}\``, `    ${quote}`,
    `\`\`\`md\n${quote}\n\`\`\``, `<!-- ${quote} -->`,
    `## History\n\n${quote}`, `# Old\n\n## Now\n\n${quote}`,
    `Old note:\n- ${quote}\n- argent#1768 owes a review.`,
    `- Planned:\n\n  - ${quote}`, `Yesterday:\n${quote}`,
  ]) assert.deepEqual(extractClaims(text), [], text);
  assert.equal(extractClaims(`# State\n\n## Now\n\n- ${quote}`)[0].line, 5);
});

test('an explicit state or a wait on the same subject needs no second queued claim', () => {
  assert.deepEqual(extractClaims('argent#1768 open, one review owed.').map((c) => c.said), ['open']);
  assert.deepEqual(extractClaims('argent#1768 owes one critic, waits on its maintainer.').map((c) => c.said), ['waiting']);
});

test('a blockquote inside a list item stays quoted after removing the list marker', () => {
  for (const marker of ['-', '*', '1.']) assert.deepEqual(extractClaims(`${marker} > ${quote}`), []);
  assert.deepEqual(extractClaims(`- ${quote}`).map((c) => c.said), ['queued', 'waiting']);
});

test('queued work is advisory for closed and merged refs, quiet for open, unknown for absent', () => {
  const claim = { said: 'queued', ref: subject };
  for (const state of ['open', 'merged', 'closed']) {
    assert.equal(compare(claim, { ...real, state }).verdict, state === 'open' ? 'ok' : 'look');
  }
  assert.equal(compare(claim, null).verdict, 'unknown');
});

test('the GitHub reader retains state_reason on issues, closed PRs and merged PRs', async () => {
  for (const pull of [undefined, { merged_at: null }, { merged_at: '2026-11-06T10:00:00Z' }]) {
    for (const reason of ['not_planned', 'completed', 'duplicate', null, undefined]) {
      const result = await readState({ owner: 'org', repo: 'argent', number: 1768 }, {
        fetchFn: async () => ({ ok: true, status: 200, json: async () => ({
          state: 'closed', state_reason: reason, pull_request: pull, html_url: 'u',
        }) }),
      });
      if (reason) assert.equal(result.state_reason, reason);
      else assert.ok(!Object.hasOwn(result, 'state_reason'));
    }
  }
});

test('text shows the queued subject and the closure reason, with exit 0', async () => {
  const { code, lines } = await invoke(quote, {
    read: async ({ number }) => number === 1768 ? real : { ...real, state: 'open' },
  });
  assert.equal(code, 0);
  assert.match(lines[0], /look: queued work on org\/argent#1768, which is closed \(not_planned\) 2026-11-06/);
  assert.equal(lines.at(-1), '2 claims checked, 0 contradicted, 1 to look at');
});

test('waiting and contradiction text also show state_reason without changing verdicts', async () => {
  for (const [text, expectedCode, message] of [
    ['argent#1768 open', 1, 'said open, but'],
    ['waiting on argent#1768', 0, 'look: waits on'],
  ]) {
    const { code, lines } = await invoke(text);
    assert.equal(code, expectedCode);
    assert.ok(lines[0].includes(message));
    assert.ok(lines[0].includes('closed (not_planned)'));
  }
});

test('JSON exposes queued and state_reason, including a later failed read', async () => {
  const { code, report } = await invoke(quote, { json: true, read: async ({ number }) => {
    if (number === 1762) throw new Error('offline');
    return real;
  } });
  assert.equal(code, 2);
  assert.equal(report.schema, 1);
  assert.equal(report.complete, false);
  assert.equal(report.reason, 'offline');
  assert.deepEqual(report.counts, { checked: 1, contradicted: 0, looks: 1, notChecked: 1 });
  assert.deepEqual(report.claims[0], {
    file: 'note.md', line: 1, reference: 'org/argent#1768', said: 'queued',
    actual: 'closed', state_reason: 'not_planned', kind: 'look', url: 'u',
  });
  assert.equal(report.claims[1].kind, 'not checked');
});

test('repeated and simultaneous reads stay independent and each run deduplicates refs', async () => {
  const text = '- argent#1768 owes a review.\n- argent#1768 owes a review.';
  let reads = 0;
  const closedRun = () => invoke(text, { json: true, read: async () => { reads++; return real; } });
  const first = await closedRun();
  assert.deepEqual(await closedRun(), first);
  const [closed, open] = await Promise.all([
    closedRun(), invoke(text, { json: true, read: async () => ({ ...real, state: 'open', state_reason: 'reopened' }) }),
  ]);
  assert.deepEqual(closed, first);
  assert.equal(open.report.counts.looks, 0);
  assert.equal(reads, 3, 'one request per ref per run');
});
