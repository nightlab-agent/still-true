import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractClaims } from '../src/extract.mjs';

const c = (line, ref, said, quote) => ({ line, ref, said, quote });

test('explicit present assertions preserve the reference and the source line', () => {
  const text = '\nArchy#827 open\n#12 is still open.\nPR hslee16/Archy#13 is merged.\nIssue nightlab-agent/still-true#14 remains closed.\n';
  assert.deepEqual(extractClaims(text, { aliases: {} }), [
    c(2, { repo: 'Archy', number: 827 }, 'open', 'Archy#827 open'),
    c(3, { number: 12 }, 'open', '#12 is still open.'),
    c(4, { owner: 'hslee16', repo: 'Archy', number: 13 }, 'merged', 'PR hslee16/Archy#13 is merged.'),
    c(5, { owner: 'nightlab-agent', repo: 'still-true', number: 14 }, 'closed', 'Issue nightlab-agent/still-true#14 remains closed.'),
  ]);
});

test('a present assertion is distinct from nearby historical, planned and uncertain wording', () => {
  const pairs = [
    ['#12 is open.', '#12 was open when I started.'],
    ['#12 is open.', '#12 used to be open.'],
    ['#12 is merged.', '#12 merged yesterday.'],
    ['#12 is closed.', '#12 was closed.'],
    ['#12 merged', 'Merge #12 today.'],
    ['#12 closed', 'Closing #12 today.'],
    ['#12 is open.', '#12 will be open.'],
    ['#12 is merged.', '#12 should be merged.'],
    ['#12 is merged.', 'If tests pass, #12 is merged.'],
    ['#12 is open.', '#12 is probably open.'],
    ['#12 open', '#12 open?'],
    ['#12 is open.', 'I think #12 is open.'],
    ['#12 is open.', '#12 is open if CI passes.'],
    ['#12 is open.', '#12 is open to discussion.'],
    ['#12 is merged.', '#12 is merged into my local branch.'],
    ['#12 is closed.', '#12 is closed for maintenance.'],
  ];
  for (const [present, other] of pairs) {
    assert.equal(extractClaims(present).length, 1, present);
    assert.deepEqual(extractClaims(other), [], other);
  }
});

test('negation never implies a state and waiting for critics stays silent', () => {
  for (const text of [
    '#12 is not merged yet.', '#12 not merged', '#12 is not open.',
    '#12 is not closed.', '#12 is never merged.', '#12 is unmerged.',
    'Waiting on #12 claims and surfaces, ccs code.',
    'Fixes #12.', 'Closes #12.', 'Reopens #12.', '#12 is pending.',
    '#12 is open or closed.', '#12 is open, not merged.',
  ]) assert.deepEqual(extractClaims(text), [], text);
  assert.deepEqual(extractClaims('#12 is still open.'), [
    c(1, { number: 12 }, 'open', '#12 is still open.'),
  ]);
  for (const quote of ['Waiting on #12.', 'Waiting for #12 to merge.', 'Waiting on #12 for a response.']) {
    assert.deepEqual(extractClaims(quote), [c(1, { number: 12 }, 'waiting', quote)]);
  }
});

test('quoted wording is not the note asserting a state', () => {
  for (const text of [
    '"#12 is open."', "'#12 is open.'", '“#12 is open.”',
    'The old note says "#12 is open."', '`#12 is open.`',
    '> #12 is open.', '> old note:\n#12 is open.',
    '"Old note:\n#12 is open.\n"',
  ]) assert.deepEqual(extractClaims(text), [], text);
});

test('fenced and indented examples stay silent without shifting later line numbers', () => {
  const text = [
    '```md', '#12 is open.', '````', '',
    '~~~text', '#13 is merged.', '~~~', '',
    '    #14 is closed.', '', '#15 is open.',
  ].join('\n');
  assert.deepEqual(extractClaims(text), [c(11, { number: 15 }, 'open', '#15 is open.')]);
  assert.deepEqual(extractClaims('````\n#12 open\n```\n#13 closed'), []);
});

test('list markers are not part of the quoted sentence and CRLF lines are counted once', () => {
  const text = '\r\n- Archy#827 is open.\r\n* #12 is merged.\r\n1. #13: closed\r\n';
  assert.deepEqual(extractClaims(text), [
    c(2, { repo: 'Archy', number: 827 }, 'open', 'Archy#827 is open.'),
    c(3, { number: 12 }, 'merged', '#12 is merged.'),
    c(4, { number: 13 }, 'closed', '#13: closed'),
  ]);
  assert.deepEqual(extractClaims('- [ ] #12 is merged.\n- [x] #13 is closed.'), []);
});

test('independent list items pair current assertions with nearby nonclaims', () => {
  const text = [
    '- Archy#827 open', '- #827 was open when I started.',
    '- #12 is merged.', '- #12 will be merged.', '- "#13 is closed."',
    '- #14 is not merged yet.', '- Waiting on #15.', '- #16 is probably open.',
  ].join('\n');
  assert.deepEqual(extractClaims(text), [
    c(1, { repo: 'Archy', number: 827 }, 'open', 'Archy#827 open'),
    c(3, { number: 12 }, 'merged', '#12 is merged.'),
    c(7, { number: 15 }, 'waiting', 'Waiting on #15.'),
  ]);
  assert.deepEqual(extractClaims('- If CI passes:\n- #12 is merged.'), []);
  assert.deepEqual(extractClaims('- #12 is merged\n  if CI passes.'), []);
});

test('repository resolution belongs to the reader, without context inferred from other references', () => {
  const text = 'hslee16/Archy#827 is open.\n#12 is merged.\nArchy#13 is closed.';
  const options = { aliases: { Archy: 'someone/other' } };
  assert.deepEqual(extractClaims(text, options), [
    c(1, { owner: 'hslee16', repo: 'Archy', number: 827 }, 'open', 'hslee16/Archy#827 is open.'),
    c(2, { number: 12 }, 'merged', '#12 is merged.'),
    c(3, { repo: 'Archy', number: 13 }, 'closed', 'Archy#13 is closed.'),
  ]);
  assert.deepEqual(options, { aliases: { Archy: 'someone/other' } });
});

test('repository punctuation and case survive extraction', () => {
  const quote = 'Pull request Owner/Repo.name_test-2#42 IS CURRENTLY OPEN.';
  assert.deepEqual(extractClaims(quote), [
    c(1, { owner: 'Owner', repo: 'Repo.name_test-2', number: 42 }, 'open', quote),
  ]);
});

test('partial references and unsafe issue numbers cannot become different references', () => {
  for (const text of [
    'a/b/c#12 open', 'a//b#12 open', '/b#12 open', '#0 open',
    '#01 open', '#-12 open', '#1.5 open', '#9007199254740993 open',
    'a.b/repo#12 open', 'https://github.com/a/b/pull/12 is open.',
  ]) assert.deepEqual(extractClaims(text), [], text);
});

test('wrapped prose and shared subjects are intentionally left unparsed', () => {
  for (const text of [
    'If the tests pass,\n#12 is merged.', '#12 is merged\nif the tests pass.',
    'Yesterday:\n#12 open',
    '#12 and #13 are open.', 'Old note:\n\n> #12 open',
  ]) assert.deepEqual(extractClaims(text), [], text);
});

test('independent clauses split on semicolons and sentence ends, preserving line numbers', () => {
  const text = '- Owner/Repo.name#12 open; #13 closed. #14 merged!\n#15 open? #16 closed.';
  assert.deepEqual(extractClaims(text), [
    c(1, { owner: 'Owner', repo: 'Repo.name', number: 12 }, 'open', 'Owner/Repo.name#12 open'),
    c(1, { number: 13 }, 'closed', '#13 closed.'),
    c(1, { number: 14 }, 'merged', '#14 merged!'),
    c(2, { number: 16 }, 'closed', '#16 closed.'),
  ]);
  assert.deepEqual(extractClaims('#12 open. #13 merged.'), [
    c(1, { number: 12 }, 'open', '#12 open.'),
    c(1, { number: 13 }, 'merged', '#13 merged.'),
  ]);
  assert.deepEqual(extractClaims('#12 open; #13 closed.'), [
    c(1, { number: 12 }, 'open', '#12 open'),
    c(1, { number: 13 }, 'closed', '#13 closed.'),
  ]);
});

test('clause splitting does not promote quotes, examples, conditions or multiple subjects', () => {
  for (const text of [
    '"Old note; #12 open. #13 closed."', '`Old note; #12 open. #13 closed.`',
    'If CI passes; #12 merged.', 'Yesterday: #12 open; #13 closed.',
    'Old note: #12 open. #13 closed.',
    '#12 and #13 are open; #14 and #15 closed.',
    'Replies: #12 open, not merged.', 'Replies: #12 open, if CI passes.',
    'Replies: #12 open to discussion.', 'Replies: #12 was closed.',
    '#12 was merged into my local branch.',
    'Probably #11, waits on #12.',
    'crush has no plugin surface (crush#2038 Probably Still open).',
  ]) assert.deepEqual(extractClaims(text), [], text);
  assert.deepEqual(extractClaims('"Old note; #12 open."; #13 closed.'), [
    c(1, { number: 13 }, 'closed', '#13 closed.'),
  ]);
  assert.deepEqual(extractClaims('#11 open; if CI passes; #12 merged.'), [
    c(1, { number: 11 }, 'open', '#11 open'),
  ]);
});

test('handoff status forms apply to other refs and keep secondary refs out of claims', () => {
  const pairs = [
    ['Other#21 abc123, one review owed, waits on Other#22.', { repo: 'Other', number: 22 }, 'waiting'],
    ['PR Other#23 waits on its maintainer.', { repo: 'Other', number: 23 }, 'waiting'],
    ["Other#24's held CI waits on its maintainer, nothing to push.", { repo: 'Other', number: 24 }, 'waiting'],
    ['Replies: 2 threads updated, Other#25, no new comment or review, open, mergeable clean.', { repo: 'Other', number: 25 }, 'open'],
    ['Other#26 MERGED 10:12Z, released as 2.3.4 with our credit.', { repo: 'Other', number: 26 }, 'merged'],
    ['org/Other#27 closed by its maintainer as a duplicate of #28.', { owner: 'org', repo: 'Other', number: 27 }, 'closed'],
    ['Other#29 re-checked: open, 2 comments, unassigned.', { repo: 'Other', number: 29 }, 'open'],
    ['tool has no extension API (Other#30 Extension API open, 3 reactions).', { repo: 'Other', number: 30 }, 'open'],
    ['Other#31 was merged 10-31 12:30 and thanked the maintainer.', { repo: 'Other', number: 31 }, 'merged'],
  ];
  for (const [quote, ref, said] of pairs) assert.deepEqual(extractClaims(quote), [c(1, ref, said, quote)], quote);
});

test('real handoff matches all twelve hand labels and leaves twelve other entries silent', async (t) => {
  const [text, labels] = await Promise.all([
    readFile(new URL('./fixtures/real-handoff.md', import.meta.url), 'utf8'),
    readFile(new URL('./fixtures/real-handoff.expected.json', import.meta.url), 'utf8'),
  ]);
  const { claims: expected } = JSON.parse(labels);
  // The labels use list entry numbers; extraction reports physical Markdown lines.
  const entries = text.split(/\r\n|\n|\r/).flatMap((raw, index) => {
    const match = /^(\d+)\. /.exec(raw);
    return match ? [{ entry: match[1], line: index + 1 }] : [];
  });
  assert.equal(entries.length, 24);
  assert.equal(Object.keys(expected).length, 12);
  const claims = extractClaims(text);
  const name = ({ owner, repo, number }) => `${owner ? `${owner}/` : ''}${repo ?? ''}#${number}`;
  let recall = 0, falseClaims = 0;
  for (const { entry, line } of entries) {
    const actual = claims.filter((claim) => claim.line === line).map(({ ref, said }) => ({ ref: name(ref), said }));
    if (expected[entry]) {
      if (actual.length === 1 && actual[0].ref === expected[entry].ref && actual[0].said === expected[entry].said) recall++;
    } else falseClaims += actual.length;
  }
  t.diagnostic(`recall: ${recall}/12; false claims: ${falseClaims}/12 silent entries`);
  for (const { entry, line } of entries) {
    assert.deepEqual(claims.filter((claim) => claim.line === line).map(({ ref, said }) => ({ ref: name(ref), said })),
      expected[entry] ? [expected[entry]] : [], `entry ${entry}, Markdown line ${line}`);
  }
  assert.equal(claims.length, 12);
});

test('historical, planned and unknown Markdown sections do not supply present claims', () => {
  const text = [
    '# Handoff', '', '## History', '', '#12 is open.', '',
    '### Current', '', '#13 is merged.', '',
    '## Plan', '', '#14 is closed.', '',
    '## Examples', '', '#15 is open.', '',
    '## Current status', '', '#16 is open.', '',
  ].join('\n');
  assert.deepEqual(extractClaims(text), [c(21, { number: 16 }, 'open', '#16 is open.')]);
  const setext = 'Handoff\n=======\n\nHistory\n-------\n\n#12 open\n\nCurrent\n-------\n\n#13 closed';
  assert.deepEqual(extractClaims(setext), [c(12, { number: 13 }, 'closed', '#13 closed')]);
});

test('quotation and comment blocks remain nonclaims across blank lines', () => {
  for (const [open, close] of [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’'], ['<!--', '-->']]) {
    const text = `${open}\n\n#12 is open.\n\n${close}\n\n#13 is merged.`;
    assert.deepEqual(extractClaims(text), [c(7, { number: 13 }, 'merged', '#13 is merged.')], open);
    assert.deepEqual(extractClaims(`${open}\n\n#12 is open.`), [], open);
  }
  assert.deepEqual(extractClaims("Rick's note\n\n#12 open"), [c(3, { number: 12 }, 'open', '#12 open')]);
  assert.deepEqual(extractClaims("'Rick's old note\n\n#12 open\n\n'"), []);
  assert.deepEqual(extractClaims('‘Rick’s old note\n\n#12 open\n\n’'), []);
});

// Actual handoff excerpts supplied on Rick's board. These are not a STATE fixture.
test('supplied real board excerpts contain no supported present state assertion', () => {
  const samples = [
    "Expired assumption: 'Archy#827 open' and with it 'open 5/5' and 'next slot'.",
    'Your Archy#827 work news: #827 merged 11-05, and I thanked hslee16 once at 00:08.',
    '#797 is rebased, your review job ar797-rev is queued.',
  ];
  for (const sample of samples) assert.deepEqual(extractClaims(sample), [], sample);
});

test('quotes preserve Unicode whitespace and are capped at 160 characters', () => {
  const unicode = '#12\u2003is open.';
  assert.deepEqual(extractClaims(unicode), [c(1, { number: 12 }, 'open', unicode)]);
  const quote = `#12${' '.repeat(155)}is open.`;
  assert.deepEqual(extractClaims(quote), [c(1, { number: 12 }, 'open', quote.slice(0, 160))]);
});

test('repeated and interleaved calls are independent and returned objects are fresh', async () => {
  const text = '#12 open\nArchy#13 merged';
  const expected = [
    c(1, { number: 12 }, 'open', '#12 open'),
    c(2, { repo: 'Archy', number: 13 }, 'merged', 'Archy#13 merged'),
  ];
  assert.deepEqual(extractClaims(text), expected);
  const results = await Promise.all([text, '', text].map(async (t) => extractClaims(t)));
  assert.deepEqual(results, [expected, [], expected]);
  results[0][0].ref.number = 99;
  assert.deepEqual(extractClaims(text), expected);
});
