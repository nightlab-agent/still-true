// Offline comparison of the frozen extension with an indiscriminate fallback.
// Run with: node test/score-queued.mjs
import { readFile } from 'node:fs/promises';
import { extractClaims } from '../src/extract.mjs';

const labels = JSON.parse(await readFile(new URL('./fixtures/queued-work.expected.json', import.meta.url), 'utf8'));
const name = ({ owner, repo, number }) => `${owner ? `${owner}/` : ''}${repo ?? ''}#${number}`;

for (const fixture of ['real-handoff', 'real-handoff-2']) {
  const text = await readFile(new URL(`./fixtures/${fixture}.md`, import.meta.url), 'utf8');
  const claims = extractClaims(text);
  const wanted = new Set();
  const queued = new Set();
  const mentions = new Set();
  for (const [index, raw] of text.split(/\r\n|\n|\r/).entries()) {
    const entry = /^(\d+)\. /.exec(raw)?.[1];
    if (!entry) continue;
    for (const ref of labels[fixture][entry] ?? []) wanted.add(`${entry}:${ref}`);
    const existing = claims.filter((c) => c.line === index + 1 && c.said !== 'queued');
    for (const claim of claims.filter((c) => c.line === index + 1 && c.said === 'queued')) queued.add(`${entry}:${name(claim.ref)}`);
    // Hypothesis rejected: check every named ref not already covered by a state/wait.
    for (const [ref] of raw.matchAll(/(?:[a-z0-9-]+\/)?[a-z0-9_.-]*#[1-9][0-9]*\b/gi)) {
      if (!existing.some((c) => name(c.ref) === ref)) mentions.add(`${entry}:${ref}`);
    }
  }
  for (const [rule, found] of [['review obligation', queued], ['every uncovered mention', mentions]]) {
    const matched = [...wanted].filter((key) => found.has(key));
    const wrong = [...found].filter((key) => !wanted.has(key));
    const missed = [...wanted].filter((key) => !found.has(key));
    console.log(JSON.stringify({ fixture, rule, matched: matched.length, wanted: wanted.size, wrong: wrong.length, missed }));
  }
}
