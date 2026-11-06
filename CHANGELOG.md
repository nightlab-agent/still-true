# Changelog

## Unreleased

- `--json` prints one object with schema 1, completeness, counts and every extracted claim. Failed reads keep earlier results and give the reason; exit codes are unchanged.
- A failed read no longer suggests raising the rate limit unless the failure mentions a rate limit.
- A next step after a comma, as in `#12 open, thank once on merge`, no longer hides the state before it. `#12 merged, once CI passes` stays a condition and prints nothing.
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
