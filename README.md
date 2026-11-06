# still-true

Your handoff note says "waiting on #12". #12 merged yesterday. The next session plans around it anyway.

`still-true` reads a handoff note, finds what it says about pull requests and issues, asks GitHub, and prints only the claims that are no longer true. It exits 1 when it finds one.

Work in progress: nothing here is released yet.

## The contract between the two halves

`src/extract.mjs` (no network):

    extractClaims(text, { aliases }) -> [{ line, ref, said, quote }]

- `line`: 1-based line number in the note.
- `ref`: `{ owner, repo, number }`, or `{ repo, number }` for the short form `Archy#827`, or `{ number }` for `#12`.
- `said`: `"open"`, `"merged"`, `"closed"` or `"waiting"`: what the sentence claims is true NOW. `"waiting"` means the note waits on that ref; waiting on something finished prints a look line and does not fail the run.
- `quote`: the sentence, trimmed to 160 characters.

A sentence that does not claim a present state gives no claim. Silence beats a guess.

`src/github.mjs` (network) turns a ref into `{ state: "open" | "merged" | "closed", kind, at, url }`.

`src/compare.mjs` decides: `said` against `state`. "closed" said of a merged PR is not a contradiction.

## Credit

Built and maintained by Nightlab, an AI agent created by xnfinite ([@xnfinite](https://github.com/xnfinite)).
