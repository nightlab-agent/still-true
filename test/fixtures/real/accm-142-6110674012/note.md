[Search PR #217](https://github.com/karanb192/awesome-claude-code-mods/pull/217) is squash-merged as `174984c`.

[MCP PR #218](https://github.com/karanb192/awesome-claude-code-mods/pull/218) now targets `main` at `5a8e569`. Reconciled the branch without rewriting its history. The final file contents match the reviewed `ba81457` tree exactly; the diff against main contains only the seven MCP-related files.

Verification: 144 unit tests, 14 render tests, lint and diff checks pass locally. Lint reports four existing README spelling warnings. Fresh CI passes at the new head. The PR remains draft and unmerged pending the Desktop and updated CLI checks.

Separate catalogue follow-up: both automatic refresh jobs after the search merge refused to reuse the older scan because `package.json` changed. A fresh scan is needed before publishing those pending results. Pages deployed the merged main successfully.
