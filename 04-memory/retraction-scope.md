# Retraction scope: s652 item 3

The patch starts from the supplied snapshot. No Git metadata was supplied, so
history, ancestry and a merge-conflict check were unavailable. The reference
matcher and paragraph/prose handling are unchanged. Nothing was published.

## Reproduction and red evidence

Input, with `--repo a/b --strict --json`:

    #12 is open; no longer true, #13 is merged

Using the real extraction, CLI, GitHub reader and comparison, with deterministic
GitHub-shaped responses saying both PRs were merged, the supplied source read
only `a/b#12`, reported its open claim as contradicted, left #13 under
`unread_references`, and exited 1. After the fix it reads only `a/b#13`, reports
one matching merged claim, leaves #12 under `unread_references`, and exits 0.
Changing only #13's response to an open PR produces one contradiction and exit 1.

Before editing source, the first regression file ran with 18 failures and three
passing controls. The final `test/retraction-scope.test.mjs`, copied into the
untouched snapshot, gives **25 failures, six passes, exit 1**. With this patch it
gives **31 passes, zero failures, exit 0**. The exact input and equivalent comma
and parenthesis counterexamples fail on the supplied source. The CLI tests run
the executable against real temporary notes, permitting only the #13 request;
both text and JSON, with and without strict mode, assert output and exit status.

The cause was two different scopes treated as one: `clauses` recognized a
semicolon retraction only when it occupied the entire following clause, while
`claimsFromClause` rejected the entire clause if any field retracted anything.
The fix marks the preceding clause for a semicolon retraction and tracks claim
ownership through existing subject contexts for comma/parenthesis retractions.
Inherited facts and counted lists share ownership; new independent subjects do
not. Retraction ends subject inheritance. A mere mention does not become a new
subject. Larger colon fields do not become standalone retractions.

Retained controls include `#12 is open, #13 is open; no longer true`, standalone
retractions, nested parentheses, repeated references, counted subject lists,
conditional/historical/quoted scopes, extra prose, quoted/code retraction words,
and conservative resolution of objects such as `see #13`. Parenthetical
semicolons retain their existing fact grammar without retraction. A generated
1,296-input comparison of paired state/wait/reference/prose fields joined by
commas, semicolons, colons or parentheses gave identical outputs without
retractions. This is a bounded comparison, not a general grammar proof.

## Checks

All runs used Node 22.23.4 and npm 10.9.9; no dependencies were installed.

| Command | Exit | Result |
| --- | --- | --- |
| `npm test` on supplied source | 0 | 398 pass, zero fail, three TODO |
| `node --test test/retraction-scope.test.mjs` | 0 | 31 pass, zero fail |
| `npm test` on final source | 0 | 429 pass, zero fail, three existing TODO |
| `node 04-memory/review-newcomer/checks.mjs` | 0 | 39 JavaScript syntax checks; pack contains eight expected files, executable bin and all imports; packed example, repeats, overlap and SIGTERM checks pass |
| `node test/score-queued.mjs` | 0 | Existing supplemental results: first handoff review obligation 1/1, zero extras; second 0/2, zero extras; indiscriminate fallback has 22 and 12 extras |

Archived checks are separate from the package test glob and fail on both the
untouched supplied snapshot and the final source:

- `node --test 04-memory/review-newcomer/proofs.test.mjs`: exit 1 before individual
  tests run. Line 11 searches for an obsolete README line beginning `printf '`,
  then calls `.trim()` on undefined.
- `node 04-memory/review-release-0.1.2/cli-checks.mjs`: exit 1 at line 36. Its
  first probe expects exit 1 for `#1 merged, maybe once CI passes.`; the parser
  conservatively suppresses this conditional statement and exits 0.

Unavailable: Node 20 execution and live GitHub replay. There is no CI workflow,
lint/typecheck configuration, dependency tree or additional package check script
in this snapshot. No advisory typescript-eslint installation was available.

## Review coverage and limits

Rules/surfaces read: `AGENTS.md`, `CLAUDE.md`, `01-context/purpose.md`,
`04-memory/STATE.md`, `README.md`, `CHANGELOG.md`, `package.json`,
`nightlab-release.json`, `.gitignore`, and `00-catalog/CATALOG.md`. No contributing
guide, PR template, lint/format/type config or CI workflow was present. Checked
the executable, CLI help, extractor API, GitHub reader, comparison and neighboring
retraction tests. Only README and the unreleased changelog needed public wording
changes; help, JSON schema and exported APIs have no new options or shapes.
The changed public README/changelog text contains 13 factual sentences: 13
supported by the scope, vocabulary, control and CLI tests, zero false or
unbacked claims, and zero private house terms. Historical release entries were
left intact.

Standing reads: Dex INDEX and notes, board and TALK, Rick's reviewer index,
Know yourself section only, code-craft, code-typescript and house-style. Applied
code-reviewer, claims-and-conventions, surfaces-and-checks, typescript-reviewer
and words-and-claims lenses locally. No delegated reviewers were used. The full
s652 audit folder was not supplied; the exact input in the request was reproduced.

- **Runs twice:** the new exact-input repeat test gets identical output and a
  fresh #13 request each time. Retraction groups are local to a clause; the
  existing global regexes use `matchAll` or replacement without manual cursor
  mutation. Packed repeat checks also pass.
- **Two runs at once:** the exact-input test overlaps matching and contradicted
  #13 responses through separate calls to `run`, yielding exits 0 and 1 with
  one request each. Packed overlap checks pass; there is no new shared state.
- **Dies halfway:** the extractor has no I/O or durable state. Existing packed
  subprocess probes kill the CLI while a second request is pending after a first
  result: SIGTERM, no success summary, no disk changes, and no JSON success
  object. These lifecycle probes use the existing wait fixture, not the new
  retraction input. A killed run is incomplete; rerunning starts fresh.
- **Live GitHub differs:** new CLI fixtures stub only transport and use real
  `Response` objects and the shipped reader/comparison. They establish scope
  and exits, not current GitHub state, authentication, rate limits, proxies or
  live response compatibility. Existing reader tests and error handling pass;
  Rick should replay the accepted patch against real GitHub and run Node 20
  before shipping.

Ambiguity remains in natural-language intent: a trailing comma/parenthesis
retraction can mean one statement or several to a writer. The documented rule
uses the current recognized subject and its inherited facts; a semicolon outside
parentheses retracts the entire preceding clause. Unsupported prose does not
gain a guessed subject. This patch does not address touching prose or general
claim recall.
