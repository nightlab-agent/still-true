# 0.1.2 release review

Historical review below. F1/F2 regressions now live in
`test/review-release-0.1.2.test.mjs`; the review-folder test copy was removed.
The fix and remaining neighbour are recorded in `04-memory/release-0.1.2-fix.md`.

HOLD. Two regressions emit false contradiction lines, the tool's worst fault.
Only review evidence was added. Product files and both known CR todos are unchanged.

## Findings

- F1, blocker (wrong result on valid input), src/extract.mjs:104-109:
  deleting an entire later once field also deletes uncertainty in that field.
  `#1 merged, maybe once CI passes.` becomes a merged claim and, against an
  open PR, prints `said merged, but a/b#1 is open` and exits 1. Expected: no
  claim. The supplied review base returns no claim. `if CI passes once today`
  in the same comma field also reproduces it. Keep uncertainty words when
  exempting the intended thank-you step; do not erase the whole field.
- F2, blocker (wrong result on valid input), src/extract.mjs:261-264,314:
  flushing around a blockquote discards an earlier historical label, so
  `Old note:\n> context\n- #1 open` becomes a current open claim. Against a
  merged PR it prints `said open, but a/b#1 is merged` and exits 1. Expected:
  no claim, as at the supplied base. Preserve the historical label's scope
  across the quote while retaining independent current items outside that scope.

Both contradict 01-context/purpose.md:4 (no false alarm is worth a catch) and
the historical/uncertain exclusions documented and tested by this project.
`proofs.test.mjs` has each smallest failing assertion beside a passing control:
F1 keeps the ordinary thank-you case; F2 keeps the independent post-quote item.
Severity follows the JavaScript critic's blocker anchor: wrong results on valid input.

## Checks and boundaries

- `npm test`: exit 0, 328 tests, 326 passed, 0 failed, 2 known todos.
- `node --test 04-memory/review-release-0.1.2/proofs.test.mjs`: exit 1,
  2 failed (F1/F2), 2 passing controls. These deliberate reds are outside npm's glob.
- `node 04-memory/review-release-0.1.2/cli-checks.mjs`: exit 0; eight actual
  executable invocations, real small Markdown files, text and JSON. Both bugs
  exit 1; their conditional/historical controls exit 0. Notes stay unchanged.
  Only fetch is replaced; real extraction, REST decoding and comparison run.
- `node 04-memory/review-newcomer/checks.mjs`: exit 0; syntax checks on its
  29 JavaScript files, offline pack with eight expected files, executable/import
  loading, exact README example, repeated and overlapping runs, SIGTERM probes.
  Archive SHA-256: a5accd5b041fc31f9da3785b952efa1739761987f566a2a8cbe5e0c8c4fdf71e.
- `node test/score-queued.mjs`: exit 0, narrow rule 1/1 and 0/2 with no extras;
  indiscriminate fallback adds 22 and 12 unlabelled references. Known broader
  recall limits remain disclosed; no label was weakened to conceal a miss.
- Archived newcomer proofs: exit 1, 8 passed, 4 failed. Their old README
  assumptions are stale: they isolate printf from the added temporary-directory
  step, still test removed cache advice, and parse a replaced suffix sentence.
  These are historical review evidence, not new product findings or npm checks.

Rules read: AGENTS.md, CLAUDE.md, README.md, CHANGELOG.md, package.json,
nightlab-release.json, .gitignore, 00-catalog/CATALOG.md, 01-context/purpose.md
and 04-memory/STATE.md. No CONTRIBUTING, CI workflow, lint, format or type
configuration exists. Applied correctness, claims/conventions, surfaces/checks,
words/claims and JavaScript lenses; read craft, Node and house-style references.
Checked executable -> extraction -> resolution -> REST -> comparison -> both
output formats, failure precedence, optional reasons, packed imports and samples.
Git metadata is unavailable; source-base comparisons used a temporary copy
reversed from the supplied review.diff, not test/old (which already has F1).
No network, registry install or live GitHub checks were performed. Only Node
22.23.4 was available; Node 20, proxy and live API behavior remain unverified.

## Four questions

1. Twice: per-run state and reference cache reset. Suite and packed repeat
   checks pass, with fresh requests and unchanged notes. Both false lines recur.
2. Two at once: overlapping open/merged runs retain separate counters/results.
   Reads within a run are sequential. Separate runs can each spend API quota;
   GitHub reads are per-reference snapshots, not an atomic view.
3. Dies halfway: handled failures retain earlier results, mark incomplete and
   preserve exit 1 after a contradiction (otherwise 2). Actual SIGTERM during
   the second fetch leaves files unchanged: text retains its earlier look with
   no summary; JSON emits no object. Callers must check process termination.
4. Real system differs: subprocesses, filesystem, packing and signals were real;
   API responses were synthetic REST-shaped JSON. Live merge fields, private
   access, rate limits, aliases and proxy behavior still need Rick's live check.
   No new transport or concurrency fault was found in the exercised paths.

Before shipping: fix F1/F2, promote their regressions into the normal suite,
rerun that suite and packed checks, then verify the intended 0.1.2 artifact and
the documented example against live GitHub. The manifest here still says 0.1.1.
Seen, not this change: the two known CR todos were left alone. Strangers'
instructions: none acted on. No product fix, publication or dependency install.
