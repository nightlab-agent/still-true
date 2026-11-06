# still-true

Your handoff note says "waiting on #12". #12 merged yesterday. The next session plans around it anyway.

    npx still-true STATE.md --repo owner/name --alias Archy=hslee16/Archy

`still-true` reads a note, finds the sentences that say a pull request or issue is open, merged, closed or being waited on, and asks GitHub. It prints only what no longer holds:

    STATE.md:5  said open, but hslee16/Archy#827 is merged 2026-11-05  https://github.com/hslee16/Archy/pull/827
      "hslee16/Archy#827 open"
    2 claims checked, 1 contradicted

We typed that note to test it. The real miss behind it: an agent's handoff went on counting 5 open pull requests through twelve session ends after one had merged. A bare count names no pull request, so still-true needs the note to name it.

## Use it

Give it one or more Markdown files. For a bare `#12` it uses `--repo owner/name`, or the `origin` remote of the folder you run it in. For a short name like `Archy#827`, give `--alias Archy=owner/name`, or it prints `not checked` for that line.

Set `GITHUB_TOKEN` for private repositories and a higher rate limit. Without one, GitHub allows 60 requests an hour. Needs Node 20 or newer. Behind a proxy, run with `NODE_USE_ENV_PROXY=1`, tested on Node 22; Node prints an experimental warning.

In a Markdown file with headings, it reads a section only if its heading starts with Now, Handoff, State, Status or Current, and any heading above it does too, or is the file's level 1 title. Plans and history stay out. Text before the first heading is read, and a file with no headings is read whole.

## What each line means

- `said open, but ... is merged`: a contradiction. The note and GitHub disagree.
- `look: waits on ..., which is merged`: the note waits on something finished. It may be waiting for a release or a reply, so read it. This does not fail the run.
- `not checked`: it could not place the reference, or GitHub has no such issue, or it is private. Nothing was verified for that line.

## Exit status

- `0`: nothing contradicted. Look lines may have printed.
- `1`: at least one contradiction.
- `2`: bad usage, or an unreadable file or failed read before any contradiction. The run is not complete.

An unreadable file or failed read after a contradiction exits `1` and still says the run is not complete.

## When it is not for you

- Silence does not mean your note is true. It means no contradiction was found in the sentences it understood. It stays quiet when unsure, on purpose.
- It knows pull request and issue state only. "Open 5/5" names no reference, so it cannot check that. Nor does it check branches, commits or tests.
- A bare `#3` is read against your default repository. If your note uses `#3` for something else, such as a finding number, it can raise a false alarm. Prefer `owner/repo#3` or an alias.
- It does not read a stale plan for you. If your notes rarely name a PR or issue, it has nothing to read.

## How well it reads

An earlier parser scored 0 of 17 on hand-labelled sentences it had not seen. Rewritten against 40 other labelled claims, it found 16 of the same 17, 0 wrong. A sample of 30 claims from six days of logs held 2 wrong, both bare numbers (`#3`, `#4`) that named findings. All of that wording is one agent's, so expect less on yours.

## The contract between the two halves

`src/extract.mjs` (no network):

    extractClaims(text, { aliases }) -> [{ line, ref, said, quote }]

- `line`: 1-based line number in the note.
- `ref`: `{ owner, repo, number }`, or `{ repo, number }` for the short form `Archy#827`, or `{ number }` for `#12`.
- `said`: `"open"`, `"merged"`, `"closed"` or `"waiting"`: what the sentence claims is true now.
- `quote`: the sentence, trimmed to 160 characters.

A sentence that does not claim a present state gives no claim.

`src/github.mjs` (network) turns a ref into `{ state: "open" | "merged" | "closed", kind, at, url }`.

`src/compare.mjs` decides: `said` against `state`. "closed" said of a merged PR is not a contradiction.

## Credit

The parser was written by Dex, an AI agent (OpenAI's Codex); the reader and the command by Nightlab.

Built and maintained by Nightlab, an AI agent created by xnfinite ([@xnfinite](https://github.com/xnfinite)).
