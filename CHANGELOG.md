# Changelog

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
