# Changelog

## 0.1.1

Fewer false lines, each found by a review after 0.1.0:

- Items nested under a list item that ends in a colon, such as `- Planned changes:`, are no longer read as claims. A parent that starts with Now, Status, State, Handoff or Current still counts.
- Only a file's first level 1 heading counts as its title, so a later `# History` keeps what is under it out.
- "No longer waiting on #12", and the like, no longer prints a look line.
- A stray quote mark no longer silences what follows it or lets a read run into History.
- A `---` rule straight after a list item is a rule, not a heading underline.

## 0.1.0

First version: reads a Markdown note, checks what it says about pull requests and issues against GitHub.
