# Changelog

## Unreleased

- `#12 is squash-merged` reads as merged. A leading inline Markdown link uses its label as the subject, so ``[Search PR #12](url) is squash-merged as `abcdef0`.`` also reads one merged claim. The destination does not select the repository. Qualifiers and retractions remain conservative; a later "The PR" is not tied to an earlier reference.
- A retraction no longer hides a separate claim written after it in the same clause: `#12 is open; no longer true, #13 is merged` retracts #12 and checks #13. Comma and parenthesis retractions apply to their current subject; a semicolon retraction outside parentheses still takes back every claim in the preceding clause. Retracted references remain under `no claim read`; surviving claims determine contradictions and whether anything was verified for `--strict`.
- Complete single-line claims survive unrelated unindented prose on the next or previous line: `Notes from today.` immediately before or after `#12 open` no longer hides #12. Source line numbers are retained. Wrapped qualifiers, retractions and Markdown scope rules stay conservative; unrelated references and incomplete wrapped claims are not promoted into claims.
- Short repository names match `--repo` and `--alias Name=owner/name` without regard to case, preserving the configured repository spelling. Exact alias keys retain precedence; a name that matches only by ignoring case, where those aliases point at different repositories, stays `not checked`.
- Very long lines read fast: a line of about 80,000 characters took over a second in 0.5.0 and now takes tens of milliseconds.

## 0.5.0 - 2026-11-08

- A leading `only` can start a statement about a reference's state: `only owner/repo#12 (merged 11-07, known)` now reads one merged claim. Unrelated prefixes such as `see only` still give no claim.
- A standalone retraction immediately after a semicolon now takes back the preceding clause on the same line: `#12 is open; no longer true` gives no claim. It uses the existing parenthesis/comma retraction wording, including `not true`, `outdated`, `wrong` and `incorrect`. Extra prose, quotations and inline code do not qualify; a claim in its own clause, after another semicolon or sentence end, remains checked. Existing parenthesis and comma behavior is unchanged. A retracted-only note still exits `3` with `--strict` (nothing verified), or `0` without it, and lists the reference as `no claim read`.

## 0.4.0 - 2026-11-08

- New line, `no claim read`: a reference on a line it read that gave no claim is listed with its line, and counted in the summary. A green run on a real note had read 4 of 9 references and said nothing of the other 5. `--json` adds `unread_references`. No exit code changes.
- A claim taken back in parentheses on the same line is no longer read as a claim: `#12 is open (no longer true)` gives nothing to check. A retraction after a semicolon, `#12 is open; no longer true`, is not read yet and still checks the claim. Only a field that is nothing but the retraction counts, so `#12 is open (fixes outdated documentation)` keeps its claim.

## 0.3.0 - 2026-11-07

- `--strict`: exit 3 when any note had no claim to verify or a claim could not be checked, so a green run can mean the note was really read. Without the flag every exit code is unchanged.

## 0.2.0 - 2026-11-07

- README: a short name also resolves through a matching `--repo`, the wordings it does not read yet are listed, Node 20 tested, the proxy setting's limit on Node 20 stated, the miss corrected to six session ends.
- A wait that a later clause cancels, as in `Waiting on #1 and a slot is no longer necessary.`, no longer prints a look.
- The skip line now gives the whole rule: a section is read only if its heading and every heading above it, apart from the file's title, start with one of the names. With more than one file, each skipped section names its file, in text and in `skipped_sections`.
- README: one line on what it is, a note to try it on, how to remove it, and `skipped_sections` in the JSON section.
- A run that finds no claims in any input file names the sections it skipped, and `--json` lists them in `skipped_sections`. If any file supplies a claim, skipped sections are not reported.
- Counted review obligations such as `argent#1768 81004b3 owes one critic` now check the queued reference as well as any explicit dependency. Finished references produce advisory look lines; a look alone exits `0`. These additional claims can change the run's exit status: a failed queued read stops the run (`2` before any contradiction, `1` after one), and a queued line can keep a neighbouring state claim from being suppressed as adjacent nonclaim prose, exposing a contradiction (`1`). Bare mentions and past-tense obligations stay quiet.
- Look and contradiction lines, and JSON claims, retain GitHub's `state_reason` when supplied. It adds context without changing verdicts.
- Blockquoted lines, including quotes inside nested list markers, contribute no state, wait or queued-work claims. They no longer silence the preceding paragraph or an independent list item after them; unmarked prose continuation lines still stay out. A quote preserves an earlier historical label's scope over following list items.
- `--json` prints one object with schema 1, completeness, counts and every extracted claim. Failed reads keep earlier results and give the reason; exit codes are unchanged.
- A failed read no longer suggests raising the rate limit unless the failure mentions a rate limit.
- A next step after a comma, as in `#12 open, thank once on merge`, no longer hides the state before it. Other uncertainty words in that field still suppress the claim. `#12 merged, once CI passes` and `#12 merged, maybe once CI passes` stay conditions and print nothing.
- `To do:` covers its nested items, as `Planned:` does.
- A comment at the end of a list item no longer costs that item its scope.
- `#12 merged, only once CI passes` and a condition on a second reference stay conditions.
- A comment alone on its line no longer ends a scope such as `Old note:`.

## 0.1.1

Fewer false lines, each found by a review after 0.1.0:

- Items nested under a list item with a planning word, such as `- Planned changes:`, are no longer read as claims, loose lists, bold labels and comments between items included.
- `- Status:` and other current labels no longer lose their first item.
- Only a file's first level 1 heading counts as its title, and a first `# History` is not a title, so history under it stays out.
- "No longer waiting on #12", and the like, no longer prints a look line. A live wait in the next comma field still does.
- A heading inside a quote still ends the current section, so a quote cannot carry a read into History.
- A quote mark nothing closes no longer silences what follows it, unless it stands alone on its line.
- A `---` rule after a list item is a rule, not a heading underline.

Known and left for later, each one a line it stays quiet on, never a false line: a second stray quote later in the file can pair with the first, a wrapped list item can hide its own claim, and "not waiting on #1 but waiting on #2" prints no look.

## 0.1.0

First version: reads a Markdown note, checks what it says about pull requests and issues against GitHub.
