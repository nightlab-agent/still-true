# Newcomer change review before 0.1.2

Verdict: changes requested for demonstrated data loss and false public text.
Application source and ordinary tests are unchanged by this review. This folder
contains review evidence only; proofs.test.mjs deliberately has failing tests
and is outside the npm test glob.

## Scope and steps

1. Read the Dex index and both note files, the duo board, the library's Know
   yourself section, the critic catalog, code-craft, code-typescript and
   house-style. Applied correctness, claims/conventions, surfaces/checks,
   words/claims and JavaScript lenses directly. No other agents were used.
2. Read repository rules: AGENTS.md, CLAUDE.md, 01-context/purpose.md,
   04-memory/STATE.md, README.md, CHANGELOG.md, package.json,
   nightlab-release.json, .gitignore and 00-catalog/CATALOG.md. Also read both
   earlier review/evaluation notes in 04-memory. No CONTRIBUTING, CI workflow,
   lint, format or type configuration exists in this copy. npm test is the only
   configured check. Style: dependency-free ESM, named functions, Node's test
   runner, exceptions caught at the command boundary, injected readers in tests.
3. Tried git status and the requested range diff: unavailable, because this
   supplied copy has no Git metadata. Read the entire supplied review.diff
   instead. It changes the CLI's skipped-section collection and explanation,
   README/CHANGELOG, names in notes/fixtures, and test names/expectations.
   History, independent endpoint identity, ancestry and conflicts cannot be
   checked here. No finding is based on a guessed commit history.
4. Read all four application modules, the executable and surrounding CLI,
   GitHub, comparison, JSON, queued-work, release, extraction and skip tests.
   Compared the changed assertions with the diff; the unchanged renamed file
   is recorded as 100% identical there. Both renamed suites match test/*.test.mjs.
   A search for the old test names and the agent's private name in public/product/test files and
   the three edited notes returned no matches. It did not inspect credentials.
5. Ran npm test: exit 0, 324 tests, 322 pass, 0 fail, 2 existing TODOs.
   Runtime: Node v22.23.4, npm 10.9.9. No dependency installation.
6. Checked the README against source and fixtures, with the sentence inventory
   below. Ran node test/score-queued.mjs: exit 0; narrow rule 1/1 and 0/2 with
   zero extras; all-mentions alternative adds 22 and 12 unlabelled references.
   Ran node --test --test-name-pattern='matches the hand labels'
   test/extract.test.mjs: exit 0, 59 pass. Its diagnostics recount 13/13 required,
   0 false, 0 optional; and 28/28 required, 0 false, 2 optional.
7. Ran an initial isolated npm-cache experiment: created disposable _npx and
   _cacache marker files, then npm cache clean --force with separate empty user
   and global npm configuration and a scratch cache. Exit 0; _cacache removed,
   _npx retained. No actual user cache was cleaned. No network or install.
8. Wrote and ran node --test 04-memory/review-newcomer/proofs.test.mjs:
   exit 1, 8 pass, 4 fail. Each finding has its failing assertion and a passing
   comparison. Four additional tests check the JSON paragraph, including its
   failure exception, unresolved claims and mixed-file order.
9. Ran node 04-memory/review-newcomer/checks.mjs: exit 0. It checks syntax of
   28 JavaScript files (26 existing and the two review scripts), then packs
   offline with isolated empty npm configuration and --ignore-scripts.
   The archive has exactly LICENSE, README.md, package.json, bin/still-true.js
   and src/{cli,compare,extract,github}.mjs. Bin mode is 0755; packed imports
   and actual executable help/JSON-help load. Archive SHA-256:
   305ba3b9c36b3c7e04804d62e4938648a3924708619088ee0ebc28c613157bfc.
10. That script runs the new README note through the packed real filesystem,
    extractor, REST reader and comparator with a synthetic Response: exact
    three-line example output, exit 1. Sequential repeats make fresh requests;
    overlapping open/merged runs retain separate results. The note is unchanged.
    Two actual packed subprocesses are killed with SIGTERM during their second
    synthetic fetch. Text keeps its first look without a summary; JSON emits
    no object. Both exit by signal; hashes and paths of all scratch files are
    unchanged. Temporary files are removed by the script.

## Findings in this change

F1, blocker (data loss), README.md:11: the advertised try-it command truncates an
existing note.md in the working project. Smallest reproduction: put `my existing
work` in note.md and execute just the printed printf command. Test F1 fails:
actual is the three-line demo, expected is the original work. Its adjacent
empty-folder control passes. Smallest correction: use an exclusive temporary
file and pass its name to the CLI, or explicitly enable noclobber for creation
and stop if the file exists. No parser change is needed.

F2, major (false rule), src/cli.mjs:141 and CHANGELOG.md:5: the new assertion that
every ancestor must start with a current-section name omits the first-level
title exception. `# Project\n## Now\n#1 open` extracts one claim; the new rule
says it cannot. The claimless prefix `# Project\n## Now\n` prints the false
explanation. Test F2 fails on the missing title exception; its non-title
`## Project\n### Now\n#1 open` control remains suppressed and passes.
Evidence: src/extract.mjs:231-237 and README.md:34 explicitly implement/document
the exception. Smallest correction: copy that qualification into the diagnostic
and changelog; leave the parser and known cosmetic title listing alone.

F3, major (false removal instruction), README.md:73: npm cache clean --force
does not remove the _npx copy on the installed npm 10.9.9. Smallest test: create
one marker under an isolated cache/_npx/copy, run the exact command with that
cache, assert the marker is gone. F3 fails with `_npx copy still exists`;
the otherwise identical _cacache control passes. Smallest correction: remove
the claim that this command clears the npx copy. Do not replace it with another
unverified command or a broad deletion of the user's cache.

F4, minor (overgeneralized count), README.md:24: the literal `, 1 to look at`
is promised for any note with looks, but two looks produce `, 2 to look at`.
Smallest test: `- waiting on #1\n- waiting on #2` with both references merged.
F4 fails with `2 claims checked, 0 contradicted, 2 to look at`; the one-wait
control passes. Evidence: src/cli.mjs:144 interpolates looks. Smallest correction:
say "With one thing to look at, the last line adds ...". No code change.

## README sentence audit

TRUE below means supported by this code or reproduced locally, not verified
against today's registry or live GitHub. Illustrations and advice are identified
separately. Multiple sentences on one source line are accounted for together.

| README lines | Sentence(s) and result | Evidence or limit |
|---|---|---|
| 3 | Checks note PR/issue claims: TRUE | executable -> extract -> resolve/read -> compare |
| 5 | Waiting/merged/next-session story: illustrative | No claim that this is a measured test |
| 7, 9-12 | Command arguments and out-of-date demo parse: TRUE locally; unsafe creation: F1 | packed example matches exactly; live #827 state/date not verified |
| 14-16 | Help contains every documented option and exit code: TRUE | USAGE/JSON_HELP/EXIT_HELP and executable smoke checks |
| 18 | Reads state/waits; checks queued reviews; prints contradictions/looks: TRUE for its documented grammar | extract, compare, CLI tests; later limits qualify recall |
| 20-22 | Filename, physical line 3, quote, count and formatting: TRUE on injected merged response | packed example; real merge date remains an external fact |
| 24 | Always literal 1 look: FALSE | F4 |
| 26 | Five PRs/twelve session ends: UNVERIFIED anecdote; a bare count supplies no reference: TRUE | founding-line test records related wording but not the historical count/timing; makeClaim needs REF |
| 30 | Multiple files; explicit/default origin repo; alias/unchecked behavior: TRUE | CLI, resolveRef, repoFromRemote and executable tests |
| 32 | Token passed for private/rate-limit use: implementation TRUE; GitHub quota 60/hour: not independently verified | executable token -> authorization header; no live calls |
| 32 | Needs Node >=20: manifest TRUE, floor runtime UNTESTED | package.json; only Node 22 installed |
| 32 | Proxy flag, previous Node-22 testing and experimental warning: UNVERIFIED here | failure hint exists; ordinary transport fake cannot establish proxy support or warning |
| 34 | Current heading/ancestors plus first title; excluded History/Archive/Old title; plans/history filtering; pre-heading/no-heading input; names skips with no claims: TRUE within documented grammar | extract:15-23, 231-238, 293-305; skip regressions and release tests |
| 38 | State mismatch is contradiction: TRUE | compare and CLI tests |
| 39 | Finished dependency gives a look; remaining release/reply is possible; advisory exit: TRUE | compare waiting branch; rationale is a possibility, not a measured outcome |
| 40 | Finished queued review gives look; queue may need re-reading; advisory exit: TRUE | compare queued branch and queued tests |
| 41 | Unplaced/missing/private is not checked; verifies nothing for that claim: TRUE | resolveRef null, readState 404/410, compare unknown |
| 43 | Clause-start reference, optional PR/issue/pull-request label/hash, counted obligation: TRUE | QUEUED and queued tests |
| 43 | Counts, critic/review nouns, optional still, one separating comma, comma/and wait: TRUE | REVIEW_COUNT, QUEUED, WAIT |
| 43 | Open stays quiet; bare ref/past tense/unquoted suffix excluded: TRUE | queued positive/negative tests |
| 43 | Quotes/inline code masked; both inline-suffix examples qualify: TRUE | unquoted and review-quote-neighbours tests |
| 43 | Wholly quoted/historical/planning obligations excluded: TRUE for grammar | queued scope tests; limits at line 88 qualify unknown historical wording |
| 43 | Blockquotes including nested markers add no claims: TRUE for tested forms | blockquote marker guard and quote-neighbour regressions |
| 43 | Prior paragraph and independent next item survive; lazy prose can continue quote: TRUE | review-quote-neighbours tests |
| 45 | Optional reason displayed; reason does not alter verdict: TRUE | readState, CLI 104-105/114, compare never reads reason |
| 49-55 | Exit 0/1/2, contradiction precedence, incomplete message and queued failure stop: TRUE | CLI tests, JSON tests, queued failure tests |
| 55 | Adding queued claims can expose adjacent state; sole look exits 0: TRUE | review-quote-neighbours explicitly compares old and current modules |
| 59-65 | Single JSON object/no text, same exits, schema/fields/counts/claim shape: TRUE | JSON tests and finish at CLI 46-52 |
| 66 | No extracted claim + skipped section gives skipped_sections, per-file with multiple inputs: TRUE on complete runs | proofs JSON tests; CLI 77-87, 138-142 |
| 66 | Empty successful extraction is complete:true/exit0; check checked count too: TRUE as necessary warning | not a guarantee of whole-note coverage; checked >0 alone is insufficient for mixed files |
| 67 | queued said; optional nonempty state_reason, omit absent/null: TRUE | queued tests, readState and JSON handling |
| 69 | Failed read/unreadable file is incomplete and retains earlier results; stops; extracted unreached claims unchecked; later files absent: TRUE | pre-recording claims and early returns; JSON tests |
| 69 | Complete can have unchecked; no claims zero counts/empty claims; JSON help field: TRUE | JSON tests; proofs unresolved case and help smoke |
| 73 | npx keeps project installation out and uses npm cache: tool itself installs nothing; npm behavior not freshly installed here | no dependencies/install hooks; isolated pack only; cache location can be configured |
| 73 | clean --force clears npx copy: FALSE | F3; npm 10.9.9 real isolated command |
| 73 | npm uninstall advice: standard invocation, NOT run against this project | no project installation created or removed |
| 73 | "It writes no files of its own": TRUE of still-true | read-only fs import, git get-url, GET requests, stdout; packed process kill snapshots unchanged; npm cache and shell demo are separate writers |
| 77 | Silence does not prove truth; incomplete recognition; deliberately conservative: TRUE | no-claim path, negative grammar cases and known misses |
| 78 | PR/issue state only; count alone unchecked; no branch/commit/test validation: TRUE | sole issues endpoint; optional commit hash is syntax, not a queried object |
| 79 | Bare finding number can resolve to default repo and falsely alert; prefer full/alias: TRUE | documented ambiguity, makeClaim and resolveRef; this predates the change |
| 80 | Does not read plans; no references gives nothing to read: TRUE for grammar | scopes plus REF requirement |
| 84 | 17 sentences/40 development claims/16 found/0 wrong: UNVERIFIED, not reproduced | no corresponding corpus, labels, frozen version or scorer in supplied files; diff previously identified this as an earlier-parser comparison |
| 84 | 30 claims/six log days/2 wrong/#3/#4: UNVERIFIED historical measurement | neither labelled log sample nor scoring record supplied; existing limitation explains possibility, not counts |
| 84 | All wording one agent's, expect less elsewhere: provenance not independently verified; caution justified | available notes acknowledge same-author evaluation; no outside-writer result here |
| 86 | Reported queued subject/dependency and development 13/13/0 extras: TRUE | extract fixture test and score script |
| 86 | Second handoff 28/28 +2 optional/0 extras: TRUE score; held out only for extension: supported by supplied development record | fixture diagnostics and queued-refs note explicitly limits provenance |
| 86 | No counted obligations; two broader work targets missed/0 of 2: TRUE | queued-work labels and score script |
| 86 | Keep narrow; scorer reproduces result; alternative 22/12 unlabelled extras: TRUE | score script output; recommendation follows measured noise |
| 86 | Small same-author samples are not outside-writer recall evidence: TRUE limitation | supplied corpus scope |
| 88 | needs review/uncounted/prelabels/shared/wrapped obligations missed: supported by narrow grammar | QUEUED and recorded scope exclusions; no new predicate introduced here |
| 88 | Historical text lacking a marker can look current; silence incomplete: TRUE | identical surface form cannot establish tense/provenance; grammar intentionally narrow |
| 92-101 | Extractor has no network; result line/ref/said/quote shape, 160-character cap, state or queued required: TRUE | makeClaim, claimsFromClause, contract tests; counts code points, not grapheme clusters |
| 103 | Reader returns normalized state/kind/time/url and optional reason: TRUE for valid REST payloads | readState and GitHub tests |
| 105 | Comparison semantics, closed includes merged, finished waits/queues advisory: TRUE | compare truth table tests |
| 109-111 | Authorship and maintainer credit: supplied attribution, not independently proven by history | exact required credit line present; Nightlab public naming consistent |

The new JSON paragraph is not a release finding: the following paragraph
explicitly establishes failure precedence. A skipped first file followed by an
unreadable second exits 2, complete:false, no skipped_sections. counts.checked
alone never establishes that every file or section was understood. The text says
to check it "too", not to treat it as sufficient proof.

## Four questions for src/cli.mjs

1. Runs twice: no saved state; counters, entries, skipped and seen are created
   inside each run. Both existing repeated-run tests and packed real-file
   repetitions pass and make fresh requests. Repeated refs within a run use the
   case-normalized cache, including cached null results. The README shell sample
   is the separate exception: running it overwrites the note (F1).
2. Two at once: packed open/merged calls overlap and stay separate; existing JSON
   and queued tests exercise the same isolation. A run reads files and references
   sequentially, so seen.set after await has no competing writer within that run.
   No shared application files/locks exist. Two processes can spend API quota
   twice; results are per-reference snapshots, not an atomic GitHub snapshot.
3. Dies halfway: handled file/REST failure preserves earlier results, records
   remaining extracted claims as unchecked, marks incomplete and keeps exit 1
   after a contradiction (otherwise 2). Actual SIGTERM probes of packed text and
   JSON processes leave all scratch files unchanged. Text may be partial; killed
   JSON emits nothing. A caller must inspect process exit/signal, not interpret
   absent output as success.
4. Real system differs: the fake read functions in many unit tests bypass HTTP.
   Packed checks instead use real readState and synthetic Response bodies, plus
   real files, npm/tar, executable loading and signals. These prove local handling,
   not current GitHub response shape, credentials, quota, proxy or registry entry.
   Actual npm differed from the README as F3 proves. Real network hangs are not
   bounded by an application timeout (unchanged); nothing here promises a bound.
   Files and GitHub state may change between separate reads. No atomic-world
   guarantee is claimed. Live checks remain with the maintainer.

## Next version and release handoff

Per the requested one-round limit, do not reopen parser design for these:
the known cosmetic listing of Project as skipped, structured skip locations,
the two existing TODO misses (mixed negated/live wait; wrapped item before a
rule), and broader current-work recall. None is new in this diff and none loses
note content. The unverified historical scores also belong on the evidence
follow-up list rather than being called a disproved result: obtain the original
17/40 and 30-log corpora, labels, scorer and parser revision, then date the
measurement explicitly. Do not represent this review as reproducing them.

Before shipping, correct F1-F4's small public-text/example issues, run npm test,
and perform the already-needed release version/Unreleased promotion. The manifest
is still 0.1.1; that is expected for this pre-release review, not a separate bug.
The maintainer must check the published 0.1.2 tarball/dist-tag and exact fresh-cache npx
entry, live public/private/missing GitHub cases, invalid credentials/rate limits,
proxy behavior and the Node 20 floor. This offline job cannot establish them.
No packages were installed, nothing was published, no messages were sent, and no
credential or token files were read. No stranger instructions were encountered.
