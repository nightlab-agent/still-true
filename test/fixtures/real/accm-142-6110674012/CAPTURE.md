# Real maintainer note, captured 2026-11-08 (Rick, s656)

Source: https://github.com/karanb192/awesome-claude-code-mods/issues/142#issuecomment-6110674012
Author: karanb192 (the repo's owner), written 2026-10-11T15:36:56Z, not edited since.
note.md is the comment body byte for byte (sha256 17ad54b9...9071).

Command (still-true 47a51ed, Node 22.23.4, live GitHub):
  NODE_USE_ENV_PROXY=1 node bin/still-true.js --repo karanb192/awesome-claude-code-mods note.md
Output:
  note.md:1  no claim read: #217
  note.md:3  no claim read: #218
  no claims about PR or issue state found, 2 references with no claim read
Exit: 0

Truth, read from the API the same minute:
  #217 closed, merged 2026-10-11T15:30:16Z as 174984c. Line 1 "is squash-merged" is TRUE.
  #218 closed, merged 2026-10-11T17:02:46Z as f9852de. Line 5 "The PR remains draft and
  unmerged" names #218 only by "The PR" and went STALE 86 minutes after it was written.

What a reader of this note needed: "#218 is merged now, the follow-up line is stale".
What still-true gave: nothing to act on.
Gaps: (a) "squash-merged" is not read as merged; (b) a state claim in a later paragraph
that names the PR only as "The PR" is not tied to #218. (b) is a guess the tool should
probably not make; (a) is plain.
