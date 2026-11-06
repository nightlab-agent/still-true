# Queued references, 2026-11-06

## Decision frozen before reading real-handoff-2 for this change

A reference alone is not evidence of current work. Read a single reference at
the start of a clause, optionally prefixed with PR, issue or pull request and
followed by a 6-to-40-digit hexadecimal commit, then a counted review obligation:
`owes a review`, `still owes two critics`, `one review owed`, and the same forms
with a, an, one, two, three or a positive integer and critic(s) or review(s).
One comma may separate the reference/hash from the obligation. The only allowed
suffix is a wait introduced by a comma or `and`, using the existing wait grammar.
All existing uncertainty and Markdown scope filters apply. This deliberately
leaves other work predicates and historical asides unparsed.

Return `said: queued`, not `open`. An open result stays quiet; a merged or closed
result is a look. A more specific state or self-wait avoids a duplicate queued
claim. Exit codes remain 0 for looks, 1 for contradictions and 2 for incomplete
runs without a contradiction. Closure does not establish that all review work
has ended.

Development used the reported sentence, real-handoff entry 2, and the cases in
queued.test.mjs. The original second fixture already trained the older state
parser; it is held out only from development of this extension, not an independent
author or a new writing style. Before measuring it, retain its existing labels
and separately label any current work references lacking state words. Accept
this narrow extension only with zero newly wrong claims and recovery of the
reported subject. Report any held-out misses rather than retuning on them.

## Test-first record

Baseline npm test: 278 pass, 0 fail, 2 existing TODOs.
New queued.test.mjs before implementation: 2 pass, 9 fail.
First implementation: 10 pass, 1 fail (a quoted wait leaked through an existing
blockquote path). With the blockquote guard: 11 pass, 0 fail.
A final scope check added a twelfth test: a blockquote inside a list item. It
failed first (11 pass, 1 fail); checking for `>` after stripping the list marker
fixed it. This changes the quotation guard, not the frozen obligation grammar.

## Evaluation

| Fixture | Existing state/wait claims | New work targets | Extra claims |
|---|---|---|---|
| real-handoff (development) | 12/12 | 1/1 queued | 0 |
| real-handoff-2 (held out for this extension) | 28/28, plus 2 permitted optional claims | 0/2 queued | 0 |

The first fixture's required labels now include queued argent#1768 as well as
waiting on argent#1762, for 13/13 total. No other original labels were removed
or relaxed. The existing Other#21 and Other#25 tests now explicitly expect their
queued subjects in addition to their original dependencies.

The second fixture contains no counted review obligations. After freezing the
rule, a manual read identified two broader current-work targets, recorded in
test/fixtures/queued-work.expected.json: Archy#780 (entry 4, fix ready on a
branch) and argent#1737 (entry 29, fixes on branches waiting on a date). Both
are still missed. Thus 28/28 guards existing coverage and the absence of extra
claims; it is not evidence of queued-review recall. No retuning on those misses.

node test/score-queued.mjs reproduces the supplemental 1/1 and 0/2 scores. Its
alternative, checking every reference not already covered by a state or wait,
recovers 1/1 and 2/2 respectively but adds 22 and 12 unlabelled references.
Those counts deduplicate by entry and reference, not by whole document. Labels
are judgments by the same two agents, not independent human truth. The decision
is to keep the narrow extension for the reported miss, without claiming broad
current-work coverage. The all-mentions alternative is too noisy on this sample.

Other misses include needs-review predicates, uncounted obligations, text labels
before the reference, more than one subject, multiline obligations, and arbitrary
trailing prose. A historical mention without historical wording or scope can
still resemble a present obligation. No claim of zero false alarms beyond the
checked examples.

## Validation steps

1. Read AGENTS.md, CLAUDE.md, README.md, 01-context/purpose.md,
   04-memory/STATE.md, package.json, nightlab-release.json, CHANGELOG.md and the
   catalog. Also read Dex's index and notes, the duo board, the library's Know
   yourself section, code-craft, code-typescript, house-style, and the correctness,
   claims/conventions, surfaces/checks, words/claims and JavaScript critic lenses.
   No CONTRIBUTING, lint/type/format config or CI workflow is present. npm test
   is the entire configured check list. This copy has no .git metadata; history,
   blame and git diff are unavailable. Source copies made before editing support
   direct diffs and the regression check below.
2. Baseline npm test: exit 0; 278 pass, 0 fail, 2 TODOs.
3. New tests before implementation: node --test test/queued.test.mjs exited 1;
   2 pass and 9 fail. Implemented extraction, advisory comparison, state_reason
   propagation through reader/text/JSON, and the quoted-wait guard. The first
   full npm test passed 289 tests with 2 TODOs.
4. Froze the review grammar before reading the second fixture for this change.
   Existing fixture tests and the supplemental scoring script ran with the
   results above. The script exited 0; it reports misses rather than treating
   advisory recall as an exit failure.
5. Ran the initial 11 new tests in a temporary copy with all four original source
   files restored: exit 1, 2 pass, 9 fail. This confirms the feature tests do not
   merely pass on the old implementation.
6. Final npm test after the list-quote fix: exit 0; 290 pass, 0 fail, 2 existing
   TODOs (the mixed negated/live wait and wrapped item before a rule). All .mjs
   and .js files under src, bin and test pass node --check. Re-ran the supplemental
   score unchanged. No dependencies installed.
7. npm pack with isolated empty npm configuration files: exit 0. The archive
   contains LICENSE, README, package.json, bin/still-true.js and all four source
   modules. Unpacked smoke checks use the real extractor, reader, comparator and
   CLI with an injected REST response, in both text and JSON: subject closed
   not_planned, dependency open, two requests, one look, exit 0. This is a local
   package check, not a registry install or a live GitHub verification.
8. Two real subprocesses, one text and one JSON, were killed with SIGTERM while
   blocked on their second read. The note stayed byte-for-byte unchanged. Text
   retained its already printed look and no summary; JSON emitted no object.
   The injected-read failure test separately checks complete:false, a retained
   look, an unchecked dependency and exit 2.
9. Reviewed source diffs, packed imports, README, JSON contract and changelog with
   correctness, claims/conventions, surfaces/checks, words/claims and JavaScript
   lenses. No further issue found in this change. No release version changed.

The state_reason response field and its nullable shape were checked against
[GitHub's issue API documentation](https://docs.github.com/en/rest/issues/issues#get-an-issue).
Tests cover issue, closed PR and merged PR payloads; completed, not_planned,
duplicate, null and missing reasons. The reader preserves any nonempty string
instead of interpreting reasons as verdicts or requiring a fixed enumeration.
Real GitHub and registry checks are still Rick's: this job did not resolve the
actual argent alias or verify #1768's live response.

## Four questions

1. Runs twice: repeated extraction and CLI tests produce the same results from
   the same inputs; each new run reads again. No persisted state or note writes.
2. Two at once: tests overlap a closed run and an open run with the same reference;
   their results remain isolated. Each run deduplicates its own repeated ref to
   one read. Concurrent runs can still each spend API quota; no shared cache.
3. Dies halfway: injected failures retain partial results and mark incompleteness.
   Actual SIGTERM checks above leave the note unchanged. A killed JSON run has no
   final object, so callers must inspect process termination, not parse silence
   as a completed clean result. A killed text run may retain partial output.
4. Real system differs: REST-shaped payloads go through readState, and optional
   reasons are tested, but there was no live GitHub read of the reported target.
   State may change after a read; the existing per-run cache is a snapshot per
   reference, not an atomic snapshot of GitHub. Alias resolution, private/missing
   refs, rate limits and failed-read exits remain covered by the full suite.
   Before shipping, Rick should run the exact note with the real alias against
   GitHub and check its reason. The held-out check establishes limited noise
   control, not broad recall or usefulness on another writer's notes.
