# F1/F2 fix, 2026-11-06

The later-step exception removes only the exempted `once`, retaining the rest
of the comma field for uncertainty checks. Quote-boundary flushes retain a
historical label; normal blank lines and headings still end its paragraph scope.
The version and both CR todos are unchanged.

Moved the four review assertions into `test/review-release-0.1.2.test.mjs` and
removed `04-memory/review-release-0.1.2/proofs.test.mjs`. Before the fix, the
four assertions gave 2 failures and 2 passing controls. All nine final tests
against the saved pre-fix extractor give 6 failures and 3 passing controls;
against the fixed extractor all nine pass. Text and JSON checks cover silence,
no GitHub reads for excluded claims, and contradictions for both live controls.

Neighbours checked: probably, might, should, could, would, if, unless, when,
until, need, get, think, believe, locally, reopened, re-opened, straight and
curly apostrophe contractions, and by Friday, before and after the exempted
`once`. Also checked `if CI passes once today`, nested quote markers, nested
list quote markers, lazy prose after a quote, multiple historical list items,
and blank-line/heading scope endings. The tested uncertainty and historical
list neighbours produce no false lines.

One false-line neighbour remains, also reproduced with the pre-fix extractor:

    Old note:
    > context
    #1 open
    #2 open

Extraction returns `#2 open` on line 4. With the CLI reader returning merged,
the run exits 1 and prints `note.md:4  said open, but a/b#2 is merged`.
Marking both continuation lines with `>` is the passing control: no claims,
exit 0. This is a lazy-quote continuation leak, left separate from F1/F2.
An additional missed-claim neighbour remains: without the historical label,
`> context\nlazy continuation\n- #1 open` gives no claim. With a blank line
before the independent item, it gives open. Neither neighbour was changed.

Checks:

- `npm test`: exit 0, 339 tests, 337 pass, 0 fail, 2 unchanged CR todos.
- `node 04-memory/review-newcomer/checks.mjs`: exit 0; syntax checks for
  30 JavaScript files, offline pack with eight expected files at version
  0.1.1, imports, executable, README example, repeats, overlapping reads and
  actual SIGTERM checks all pass. Input notes remain unchanged.
- `node test/score-queued.mjs`: exit 0; narrow-rule scores remain 1/1 and
  0/2, with zero extras. Broad fallback still adds 22 and 12 extras.
- Ran a temporary adaptation of the historical CLI probe with the two bug
  cases expecting exit 0: eight actual executable invocations, real Markdown
  files, synthetic REST transport, text and JSON all pass. The historical
  probe in the review folder retains its original bug-demonstration expectations.

Rules read: AGENTS.md, CLAUDE.md, README.md, CHANGELOG.md, package.json,
nightlab-release.json, .gitignore, 00-catalog/CATALOG.md, purpose and STATE.
No CI, lint, format or type configuration is present. Checked correctness,
claims/conventions, surfaces/checks, words/claims and JavaScript lenses.

Twice and concurrently: extraction remains synchronous with per-call state;
suite and packed repeat/overlap checks pass. Dies halfway: the parser writes
nothing, and packed SIGTERM probes retain notes without a success summary.
Real-system limit: executable, filesystem and packing checks were real;
GitHub responses were synthetic. Only Node 22.23.4 was checked, not Node 20
or live GitHub. Git metadata is unavailable in this copy.

Before shipping, decide the remaining lazy-quote false line, run live GitHub
and Node 20 checks, and verify the intended release artifact. No version bump
or language-test work was performed.
