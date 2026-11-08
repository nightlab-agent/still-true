# Squash-merged claim fix, 2026-11-08

## Capture comparison

Evidence: `test/fixtures/real/accm-142-6110674012/note.md:1,3,5`
and `CAPTURE.md:4,7-18` in the same directory. The local note's SHA-256 is
`17ad54b95117c71b77d22f7c222f0cd8bd2ec313a3cf4ef27c7d99c1746b9071`,
matching the capture's abbreviated checksum. Neither fixture file was edited.

The capture reports #217 merged at 15:30:16Z, before the note at 15:36:56Z.
Its line 1 merge claim is true. The line 5 draft/unmerged claim refers to #218
according to the capture; #218 merged at 17:02:46Z, 85 minutes 50 seconds after
the note. That claim was stale at capture time. The captured tool read zero
claims and exited 0; it verified neither statement. These are supplied captured
facts, not a new live GitHub verification.

A local replay used the real CLI, reader and unchanged note, replacing only
the reader's transport with the captured #217 state. With the saved original
extractor: zero requests, both references unread, exit 0. With the fix:

    note.md:3  no claim read: #218
    1 claim checked, 0 contradicted, 1 reference with no claim read

Exit 0, exactly one request to the issues endpoint for #217. The new regression
`test/squash-merged.test.mjs:76` asserts this text and the full JSON result,
including the line 3 unread #218 and the absence of a second request.
This fixes gap (a); it does not detect the stale #218 claim.

## Implementation and checks

Only `src/extract.mjs` changed in the implementation. STATE accepts squash-
before merged while still capturing the canonical merged state. NONSTATE keeps
negations and alternative states conservative. A leading inline link with a
simple destination exposes its label to the existing subject grammar. The
normalized label also passes the preamble guard; an example-labelled link must
not become a current claim. Quotes retain the original text and source line.
README and CHANGELOG describe the accepted form and its limits; CLI help does
not enumerate individual grammatical forms and needs no change.

Commands run with Node v22.23.4 and npm 10.9.9:

| Command | Result |
| --- | --- |
| `npm test`, before edits | Exit 0; 448 tests, 445 pass, 0 fail, 3 TODO |
| `node --test test/squash-merged.test.mjs`, tests before src edits | Exit 1; 8 tests, 2 pass, 6 fail |
| Same final test file in an isolated copy with saved original src | 8 tests, 2 pass, 6 fail |
| `node --test test/squash-merged.test.mjs`, after fix | Exit 0; 8 pass, 0 fail |
| `npm test`, after fix | Exit 0; 456 tests, 453 pass, 0 fail, 3 TODO |
| `node test/score-queued.mjs` | Exit 0; narrow rule 1/1 and 0/2, no extras; uncovered-mention alternative has 22 and 12 extras |
| `node 04-memory/review-newcomer/checks.mjs` | Exit 0; 42 JS syntax checks; 8 expected packed files, executable bin, imports present; repeat/overlap and text/JSON SIGTERM checks pass |
| `node --test 04-memory/review-newcomer/proofs.test.mjs` | Exit 1 before tests: obsolete README sample lookup calls trim on undefined, line 11 |
| `node 04-memory/review-release-0.1.2/cli-checks.mjs` | Exit 1 at line 36: actual 0, expected 1 for conditional wording |

Both archived failures reproduce using the saved original src and the same
scripts; the README line the newcomer script searches was not changed here.
These failures are outside this change. No dependency installation, publication
or live GitHub requests were performed. Only Node 22 was exercised.

## Gap (b) and four questions

Do not tie "The PR" to #218 automatically. The capture identifies its intended
subject, but proximity across paragraphs is not a general ownership rule: the
note also names #217, and ordinary prose can change subject without naming a
reference. A false attachment would break `01-context/purpose.md`'s preference
for silence over false alarms. No subject-resolution behavior was built.

- Runs twice: identical CLI results and fresh per-run requests, asserted at
  `test/squash-merged.test.mjs:107`; new regexes have no global/sticky state.
- Two at once: overlapping merged/open reads independently return exits 0/1
  in the same test. Parser state and CLI caches are local to each invocation.
- Dies halfway: extraction is synchronous and has no I/O; the changed paths
  acquire no resources or persistent state. The packed CLI SIGTERM probes in
  `04-memory/review-newcomer/checks.mjs` passed for text and JSON: no disk
  changes or success summary. Those interruption probes use waiting claims,
  not the new squash wording; no new cancellation behavior is claimed.
- Real system differs: the exact captured Markdown is exercised through the
  real parser, CLI and reader. Transport supplies the captured closed plus
  pull_request.merged_at shape, not a precomputed merged verdict. An open-PR
  control yields one contradiction, exit 1 (`test/squash-merged.test.mjs:95`).
  Live API/proxy behavior and Node 20 remain unverified by this job.

Read coverage: INDEX and both memory files, board and TALK, Know yourself,
craft/JS/house references, all five applicable critic lenses (correctness,
claims/conventions, surfaces/checks, JS, words). Repository rules read:
AGENTS.md, CLAUDE.md, README.md, package.json, nightlab-release.json,
01-context/purpose.md, 04-memory/STATE.md, 00-catalog/CATALOG.md and CHANGELOG.md.
No CONTRIBUTING, lint/type/format config or CI workflow was found. Checked
subject ownership, retractions/qualifiers, regex state, package contents,
CLI/library parity and the added public wording. No additional finding.

Before shipping: review the small src diff, replay the capture through live
GitHub, and reword or remove the private third-party fixture together with its
test dependency, as requested on the board. This report does not authorize
publishing that fixture.
