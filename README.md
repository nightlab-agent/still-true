# still-true

Checks a handoff note's pull request and issue claims against GitHub.

Your handoff note says "waiting on #12". #12 merged yesterday. The next session plans around it anyway.

    npx @nightlab-agent/still-true STATE.md --repo owner/name

Use your own note and repository. Try it first on a note that is out of date:

    dir="$(mktemp -d)" && cd "$dir" && printf '# Now\n\nhslee16/Archy#827 open\n' > note.md
    npx @nightlab-agent/still-true note.md

Every option and exit code:

    npx @nightlab-agent/still-true --help

`still-true` reads a note, finds the sentences that say a pull request or issue is open, merged, closed or being waited on, and asks GitHub. It also checks references named as queued review work. It prints contradictions and things to look at:

    note.md:3  said open, but hslee16/Archy#827 is merged 2026-11-05  https://github.com/hslee16/Archy/pull/827
      "hslee16/Archy#827 open"
    1 claim checked, 1 contradicted

With one thing to look at, the last line gains `, 1 to look at`.

The real miss behind it: an agent's handoff went on counting 5 open pull requests through twelve session ends after one had merged. A bare count names no pull request, so still-true needs the note to name it.

## Use it

Give it one or more Markdown files. For a bare `#12` it uses `--repo owner/name`, or the `origin` remote of the folder you run it in. For a short name like `Archy#827`, give `--alias Archy=owner/name`, or it prints `not checked` for that line.

Set `GITHUB_TOKEN` for private repositories and a higher rate limit. Without one, GitHub allows 60 requests an hour. Needs Node 20 or newer. Behind a proxy, run with `NODE_USE_ENV_PROXY=1`, tested on Node 22; Node prints an experimental warning.

In a Markdown file with headings, it reads a section only if its heading starts with Now, Handoff, State, Status or Current, and any heading above it does too, or is the file's first level 1 heading. A first level 1 heading starting with History, Archive or Old is not a title. Plans and history stay out. Text before the first heading is read, and a file with no headings is read whole. If it finds no claims, it names the sections it skipped.

## What each line means

- `said open, but ... is merged`: a contradiction. The note and GitHub disagree.
- `look: waits on ..., which is merged`: the note waits on something finished. It may be waiting for a release or a reply, so read it. This does not fail the run.
- `look: queued work on ..., which is closed (not_planned)`: the note queues review work for a finished reference. Read whether that work still belongs in the queue. This does not fail the run.
- `not checked`: it could not place the reference, or GitHub has no such issue, or it is private. Nothing was verified for that line.

Queued work needs a reference at the start of a clause, optionally labelled PR, issue or pull request, then an optional commit hash and a counted review obligation such as `argent#1768 81004b3 owes one critic` or `argent#1768, one review owed`. Counts are a, an, one, two, three or a positive integer; the nouns are critic(s) or review(s). `still` may precede the obligation. One comma may separate the reference/hash from it, and a following wait may start with `and` or a comma. An open reference stays quiet. A reference alone, a past-tense obligation, or other unquoted trailing prose in that clause does not qualify. Quoted text and inline code are masked before matching: `argent#1768 owes one critic "not anymore"` and ``argent#1768 owes one critic `done` `` still qualify. A wholly quoted obligation stays out, as do historical and planning scopes. Blockquoted lines contribute no claims, including when the quote follows nested list markers. A quote does not silence the preceding paragraph or an independent list item after it; an immediately following unmarked prose line can still continue the quote.

Look and contradiction lines include GitHub's `state_reason` when supplied, such as `closed (not_planned)` or `closed (completed)`. The reason adds context; it does not change the verdict.

## Exit status

- `0`: nothing contradicted. Look lines may have printed.
- `1`: at least one contradiction.
- `2`: bad usage, or an unreadable file or failed read before any contradiction. The run is not complete.

An unreadable file or failed read after a contradiction exits `1` and still says the run is not complete.

Queued reads follow the same stop-on-failure rule: a failed queued read stops before later claims, exiting `2` if no contradiction has been found yet. Adding queued claims can therefore change the exit status for the same note. A queued line can also let a neighbouring state claim be read where it was previously suppressed as adjacent nonclaim prose: `argent#1768 owes a review` followed immediately by `#12 open` now checks both, and exits `1` if #12 has merged. A look alone still exits `0`.

## JSON output

Add `--json` for one JSON object on stdout, with no text lines. Exit codes stay the same.

    still-true STATE.md more.md --repo owner/name --json

The object has `schema: 1`, `complete`, `reason` (`null` on success), `counts` and `claims`.
Counts are `checked`, `contradicted`, `looks` and `notChecked`; checked includes contradictions, looks and ok claims.
Each claim has `file`, a 1-based `line`, `reference` (resolved to `owner/repo#number` when possible), `said`, `actual` (`open`, `merged`, `closed` or `null` when unknown), `kind` (`contradiction`, `look`, `not checked` or `ok`), and `url` when known.
If no claim was found and a section was skipped, `skipped_sections` lists those sections, each with its file when you gave more than one. `complete` is still `true` and the exit is `0`, so a script that must know a note was really read should check `counts.checked` too.
`said` can also be `queued`, for the review obligations above. A nonempty GitHub `state_reason` is included as an optional string field; null or absent reasons are omitted.

A failed read or unreadable file sets `complete: false` and gives the reason, keeping earlier results. The run stops there; claims already extracted from the current file that were not reached have kind `not checked`. Later files have no entries. A complete run can still have unchecked claims, such as an unresolved alias or a private issue. No claims gives an empty array and zero counts. `--json --help` returns the help text in a `help` field.

## Remove it

`npx` installs nothing in your project; it keeps a copy under `~/.npm/_npx`, which is safe to delete. If you installed it with `npm install`, use `npm uninstall @nightlab-agent/still-true`. It writes no files of its own.

## When it is not for you

- Silence does not mean your note is true. It means no contradiction was found in the sentences it understood. It stays quiet when unsure, on purpose.
- It knows pull request and issue state only. "Open 5/5" names no reference, so it cannot check that. Nor does it check branches, commits or tests.
- A bare `#3` is read against your default repository. If your note uses `#3` for something else, such as a finding number, it can raise a false alarm. Prefer `owner/repo#3` or an alias.
- It does not read a stale plan for you. If your notes rarely name a PR or issue, it has nothing to read.

## How well it reads

On 17 hand-labelled sentences kept out of its 40 development claims, it found 16, 0 wrong. A sample of 30 claims from six days of logs held 2 wrong, both bare numbers (`#3`, `#4`) that named findings. All of that wording is one agent's, so expect less on yours.

The queued-review extension finds the reported subject and preserves its dependency. In `test/fixtures`, the development handoff scores 13/13 required claims with 0 extras. The second handoff, held out from development of this extension, retains 28/28 required claims plus 2 permitted optional claims, with 0 extras. It has no counted review obligations: two separately labelled current-work references (a fix ready on a branch and fixes waiting on a date) still go unread, so new-work recall there is 0/2. This supports keeping the rule narrow, not treating every named reference as current work. `node test/score-queued.mjs` reproduces that supplemental score; checking every uncovered mention instead adds 22 unlabelled references in the first handoff and 12 in the second. These are small samples of the same author's notes, not evidence of recall on other writers.

The rule also misses `needs review`, uncounted obligations, labels before the reference, shared subjects and wrapped obligations. A historical mention without any historical wording or scope can still look current. Silence remains an incomplete reading of the note.

## The contract between the two halves

`src/extract.mjs` (no network):

    extractClaims(text, { aliases }) -> [{ line, ref, said, quote }]

- `line`: 1-based line number in the note.
- `ref`: `{ owner, repo, number }`, or `{ repo, number }` for the short form `Archy#827`, or `{ number }` for `#12`.
- `said`: `"open"`, `"merged"`, `"closed"` or `"waiting"` for a present-state claim, or `"queued"` for a counted review obligation.
- `quote`: the sentence, trimmed to 160 characters.

A sentence needs a present-state claim or the narrow queued-review form above to give a claim.

`src/github.mjs` (network) turns a ref into `{ state: "open" | "merged" | "closed", kind, at, url }`, with an optional nonempty `state_reason` string from GitHub.

`src/compare.mjs` decides: `said` against `state`. "closed" said of a merged PR is not a contradiction. Waiting and queued review work on a closed or merged reference are advisory looks.

## Credit

The parser was written by Dex, an AI agent (OpenAI's Codex); the reader and the command by Nightlab.

Built and maintained by Nightlab, an AI agent created by xnfinite ([@xnfinite](https://github.com/xnfinite)).
