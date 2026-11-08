// State and wait grammar, shared by bare statements, labelled lists and fact fields.
const TOKEN = '[a-z0-9_./-]*#[a-z0-9_.-]+';
// Existence needs only the suffix: searching TOKEN retries every possible repo prefix.
const HAS_REF = /#[a-z0-9_.-]+/i;
const SUBJECT = new RegExp(`^((?:[^#]*\\s)?)(${TOKEN}(?:\\s+and\\s+${TOKEN})*)(.*)$`, 'i');
const STATE = /^(?:(?:is(?:\s+(?:still|currently|now))?|remains|still|currently|already|was(?=\s+merged\b)|(?:PR|issue)(?:\s+is)?)\s+)?(?:squash-(?=merged\b))?(open|merged|closed)\b(?!-)(.*)$/i;
const BEFORE_REF = new RegExp(`(?<![\\w-])\\b(open|merged|closed)\\s+((?:PR|issue|pull request)\\s+)?(${TOKEN})(.*)$`, 'i');
const COUNT_STATE = /^\d+\s+(open|merged|closed)$/i;
const WAIT = new RegExp(`(?:^|\\s)(?:waits?|waiting)\\s+(?:on|for)\\s+(${TOKEN}|(?:its|the) maintainer)(?:\\s+(?:to merge|for a response|and\\s+(?:a|an|the|its)\\s+(?!.*\\b(?:is|are|was|were)\\b)[\\w -]+))?$`, 'i');
// A counted review obligation names queued work, without asserting it is open.
// Only the obligation and an optional wait qualify; other trailing prose stays quiet.
const REVIEW_COUNT = '(?:a|an|one|two|three|[1-9][0-9]*)';
const QUEUED = new RegExp(`^(?:(?:PR|issue|pull request)\\s+)?(${TOKEN})(?:\\s+[a-f0-9]{6,40})?(?:\\s+|,\\s*)(?:still\\s+)?(?:owes\\s+${REVIEW_COUNT}\\s+(?:critic|review)s?|${REVIEW_COUNT}\\s+(?:critic|review)s?\\s+owed)(.*)$`, 'i');
const LABEL_LIST = new RegExp(`(?:^|:\\s*)(open|merged|closed)(?:\\s+(?:PRs|issues|pull requests))?:\\s*(${TOKEN}(?:\\s*(?:,|and)\\s*${TOKEN})*)$`, 'i');

const REF = /^(?:([a-z0-9-]+)\/)?([a-z0-9_.-]+)?#([1-9][0-9]*)$/i;
const MENTION = /(?<![\w./#-])(?:[a-z0-9-]+\/)?[a-z0-9_.-]*#[1-9][0-9]*(?![\w-]|\.\w)/gi;
const PLANNED = /\b(?:plans?|planned|planning|proposed|intended|expected|ideas?|goals?|draft|to[- ]?dos?|next|later|someday|old|previous|history|example)\b/i;
const CURRENT_HEADING = /^(?:handoff|state|status|now|current)\b(?!-)/i;
const PREAMBLE = /^(?:if|unless|once|after|when|until|yesterday|old note|example|suppose|imagine)\b/i;
const UNCERTAIN = /\b(?:probably|maybe|might|should|could|would|if|unless|when|until|need|get|think|believe|locally|re-?opened)\b|\bonce\s+(?!at\b)\S|n['’]t\b|\bby\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|next)\b/i;
const NONSTATE = /\b(?:(?:not|never|no longer)\s+(?:(?:yet|still|currently|already)\s+)?(?:open|(?:squash-)?merged|closed)|(?:was|were|used to be)\s+(?:(?:still|currently|already)\s+)?(?:open|closed)|(?:open|(?:squash-)?merged|closed)\s+or\s+(?:open|(?:squash-)?merged|closed))\b/i;
// The writer takes the claim back on the same line: "#12 is open (no longer true)".
// Only a field that is nothing but the retraction counts, so "(fixes outdated documentation)" keeps its claim.
const RETRACTION = /^(?:(?:no\s+longer|not)\s+(?:true|the\s+case|accurate|current)|outdated|wrong|incorrect)$/i;
const RETRACT_FILLER = /\b(?:which|that|this|it|is|was|now|anymore|any\s+more|see\s+below)\b/gi;
const isRetraction = (field) => RETRACTION.test(field.replace(RETRACT_FILLER, ' ').replace(/[.!]/g, ' ').replace(/\s+/g, ' ').trim());
const NOT_WAITING = /\b(?:(?:not|never|no\s+longer|no\s+more|stop(?:s|ped)?|done|finished|quit|gave\s+up|nothing(?:\s+is)?|without|instead\s+of)\s+(?:(?:yet|still|currently|really)\s+)?(?:waits?|waiting)|(?:n['’]t)\s+(?:waits?|waiting))\b/i;
const QUALIFIED_STATE = /^\s+(?:to|into|for|or|after)\b/i;
// A later comma field must look like a state fact, not "open question".
const COMMA_STATE_TAIL = /^(?:$|\s+(?:\d|today\b|yesterday\b|last\b|since\b|by\b|as\s+a\s+duplicate\b))/i;
// An initial "open PR" needs a predicate to distinguish it from a command.
const OPEN_PREDICATE = /^\s+(?:is|has|needs|touches)\b/i;
const OPEN_POSSESSIVE = /(?:['’]s|\b(?:my|our|your|their|his|her|its))\s*$/i;
// Subjects may have "only", a noun label or a possessive determiner, but objects of
// phrases such as "a PR for issue #12" are not the subject of that PR's state.
const SUBJECT_PREFIX = /^(?:only|(?:PR|issue|pull request)|(?:[\w'-]+\s+)+(?:PR|issue|pull request)|(?:the\s+)?[\w-]+['’]s|(?:my|our|your|their|his|her|its)(?:\s+own)?)?$/i;
const OBJECT_PREFIX = /\b(?:for|of|on|about|after)\b/i;

function nextQuote(raw, i, quote) {
  const pairs = { '"': '"', "'": "'", '“': '”', '‘': '’' };
  const char = raw[i];
  const apostrophe = /['’]/.test(char) && /[\p{L}\p{N}]/u.test(raw[i - 1] ?? '') && /[\p{L}\p{N}]/u.test(raw[i + 1] ?? '');
  if (quote) return char === quote && !apostrophe ? null : quote;
  return Object.hasOwn(pairs, char) && !/[\p{L}\p{N}_]/u.test(raw[i - 1] ?? '') ? pairs[char] : null;
}

function endQuote(raw, quote) {
  for (let i = 0; i < raw.length; i++) quote = nextQuote(raw, i, quote);
  return quote;
}

function clauses(raw) {
  const result = [];
  let afterSemicolon = false;
  const add = (clause) => {
    // A leading retraction field takes back the preceding clause, including
    // all its comma-separated claims. Later fields may name independent work.
    const first = afterSemicolon ? /^([^(),]*)(?:,|$)/.exec(unquoted(clause)) : null;
    if (afterSemicolon && first && isRetraction(first[1])) {
      if (result.length) result[result.length - 1].retracted = true;
      result.push({ quote: clause.slice(first[0].length).trim(), retracted: false });
    } else result.push({ quote: clause, retracted: false });
  };
  let start = 0, quote = null, code = null, depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (!quote && char === '`') {
      const run = /^`+/.exec(raw.slice(i))[0];
      if (!code) code = run;
      else if (code === run) code = null;
      i += run.length - 1;
      continue;
    }
    if (code) continue;
    quote = nextQuote(raw, i, quote);
    if (quote || /["'“”‘’]/.test(char)) continue;
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth === 0 && (char === ';' || (/[.!?]/.test(char) && /\s|^$/.test(raw[i + 1] ?? '')))) {
      add(raw.slice(start, char === ';' ? i : i + 1).trim());
      afterSemicolon = char === ';';
      start = i + 1;
    }
  }
  add(raw.slice(start).trim());
  return result.filter((clause) => clause.quote);
}

function makeClaim(token, said, quote, line) {
  const parts = REF.exec(token);
  if (!parts) return null;
  const [, owner, repo, digits] = parts;
  const number = Number(digits);
  if (!Number.isSafeInteger(number) || (owner && !repo)) return null;
  const ref = owner ? { owner, repo, number } : repo ? { repo, number } : { number };
  return { line, ref, said: said.toLowerCase(), quote: [...quote].slice(0, 160).join('') };
}

// Mask quotations and inline code before looking for facts inside parentheses.
function unquoted(raw) {
  let result = '', quote = null, code = null;
  for (let i = 0; i < raw.length; i++) {
    if (!quote && raw[i] === '`') {
      const run = /^`+/.exec(raw.slice(i))[0];
      if (!code) code = run;
      else if (code === run) code = null;
      result += ' '.repeat(run.length);
      i += run.length - 1;
      continue;
    }
    if (code) { result += ' '; continue; }
    const previous = quote;
    quote = nextQuote(raw, i, quote);
    result += previous || quote ? ' ' : raw[i];
  }
  return result;
}

// "#12 open, thank once on merge": once mid-field in a later comma field belongs to that step, not to the state before it.
// Keep the field's other uncertainty words, and conditions naming a reference or narrowed by "only".
const LATER_STEP_ONCE = /,\s*[^,]*?\S\s+once\s[^,]*/g;
const laterStep = (field) => (field.includes('#') || /\b(?:only|just|not|except|unless)\b/i.test(field) ? field : field.replace(/\bonce\b/i, ''));

function claimsFromClause(quote, line) {
  // A leading inline link supplies its label to the subject grammar, never its destination.
  const body = unquoted(quote).replace(/^\[([^\[\]]+)\]\([^()\s]+\)(?=\s)/, '$1');
  if (!body.includes('#') || body.includes('?') || PREAMBLE.test(body) || UNCERTAIN.test(body.replace(LATER_STEP_ONCE, laterStep)) || NONSTATE.test(body)) return [];
  const claims = [];
  const retracted = new Set();
  // Inherited parenthetical facts share a group; independent subjects own theirs.
  let context = { subjects: [], list: false, label: false, state: null, hadRef: false,
    group: { claims: [], retracted: false } };
  const add = (tokens, said) => {
    if (context.group.retracted) return;
    for (const token of tokens) {
      const claim = makeClaim(token, said, quote, line);
      if (!claim) continue;
      const existing = claims.find((c) => !retracted.has(c) && c.said === claim.said &&
        c.ref.owner === claim.ref.owner && c.ref.repo === claim.ref.repo && c.ref.number === claim.ref.number);
      if (!existing) claims.push(claim);
      context.group.claims.push(existing ?? claim);
    }
  };
  const labelled = LABEL_LIST.exec(body.trim().replace(/[.!]$/, ''));
  if (labelled) add([...labelled[2].matchAll(new RegExp(TOKEN, 'gi'))].map((m) => m[0]), labelled[1]);
  const stack = [];
  let afterComma = false;
  // Commas separate fact fields; parentheses save and restore subject scope.
  // A semicolon inside parentheses can bound a retraction field too. Keep the
  // existing fact grammar for such semicolons when there is no retraction.
  const fields = body.includes(';') && body.split(/[(),;]/).some(isRetraction)
    ? /([^(),:;]*)([(),:;]|$)/g : /([^(),:]*)([(),:]|$)/g;
  for (const field of body.matchAll(fields)) {
    const text = field[1].trim().replace(/[.!]$/, '');
    const delimiter = field[2];
    if (delimiter !== ':' && body[field.index - 1] !== ':' && isRetraction(text)) {
      for (const claim of context.group.claims) retracted.add(claim);
      context.group.retracted = true;
      context.subjects = [];
      context.list = false;
      context.state = null;
    }
    const bareState = STATE.exec(text);
    const subject = bareState ? null : SUBJECT.exec(text);
    let tail = text;
    if (subject) {
      context.hadRef = true;
      const prefix = subject[1].trim();
      const tokens = subject[2].split(/\s+and\s+/i);
      if (SUBJECT_PREFIX.test(prefix) && !OBJECT_PREFIX.test(prefix) &&
          (tokens.length === 1 || context.label || context.state)) {
        if (!context.list && !(context.state && !subject[3].trim())) context.group = { claims: [], retracted: false };
        context.subjects = context.list ? [...context.subjects, ...tokens] : tokens;
        tail = subject[3].trim();
        context.list = !tail && (context.label || stack.length > 0 || context.state !== null);
        if (context.state && !tail) add(tokens, context.state);
      } else {
        context.subjects = [];
        context.list = false;
      }
    }
    // An issue title within a parenthetical fact may sit between REF and STATE.
    const statusText = subject && stack.length ? tail.replace(/^(?:[A-Z][\w-]*\s+)+(?=(?:open|merged|closed)\b)/, '') : tail;
    const state = bareState ?? STATE.exec(statusText);
    const waiting = WAIT.exec(tail);
    const before = BEFORE_REF.exec(text);
    const beforeSubject = before && (!subject || before.index < subject[1].length) &&
      (before[1].toLowerCase() !== 'open' || (before[2] &&
        (OPEN_POSSESSIVE.test(text.slice(0, before.index)) || OPEN_PREDICATE.test(before[4])))) &&
      !QUALIFIED_STATE.test(before[4]);
    if (beforeSubject || (waiting && !NOT_WAITING.test(text) && REF.test(waiting[1]) && !context.subjects.length)) {
      context.group = { claims: [], retracted: false };
    }
    if (state && !QUALIFIED_STATE.test(state[2]) &&
        (!bareState || !afterComma || COMMA_STATE_TAIL.test(state[2]))) {
      add(context.subjects, state[1]);
      context.list = false;
    }
    if (waiting && !NOT_WAITING.test(text)) add(REF.test(waiting[1]) ? [waiting[1]] : context.subjects, 'waiting');
    if (beforeSubject) add([before[3]], before[1]);
    // A second ref in the predicate may be an object, not the next subject.
    if (subject && HAS_REF.test(tail)) {
      context.subjects = [];
      context.list = false;
    }
    if (delimiter === ':') context.label = true;
    if (delimiter === '(') {
      const count = COUNT_STATE.exec(text);
      stack.push(context);
      context = { subjects: [...context.subjects], list: false, label: context.label,
        state: count ? count[1] : null, hadRef: false, group: context.group };
    } else if (delimiter === ')' && stack.length) {
      const child = context;
      context = stack.pop();
      // A ref inside parentheses interrupts the inherited subject's fact chain.
      if (child.hadRef) { context.subjects = []; context.list = false; context.hadRef = true; }
      if (context.group.retracted) { context.subjects = []; context.list = false; context.state = null; }
    }
    afterComma = delimiter === ',';
  }
  const queued = QUEUED.exec(body.trim().replace(/[.!]$/, ''));
  if (queued) {
    const rest = queued[2].trim();
    const wait = /^(?:,\s*|and\s+)/i.test(rest) ? WAIT.exec(rest.replace(/^(?:,\s*|and\s+)/i, '')) : null;
    const claim = makeClaim(queued[1], 'queued', quote, line);
    // An existing state or self-wait is more specific; avoid two looks for it.
    if ((!rest || wait?.index === 0) && claim && !claims.some((c) =>
      c.ref.owner === claim.ref.owner && c.ref.repo === claim.ref.repo && c.ref.number === claim.ref.number)) claims.unshift(claim);
  }
  return claims.filter((claim) => !retracted.has(claim));
}

function claimsFromLine(raw, line) {
  if (/^(?: {4}|\t)/.test(raw)) return [];
  const body = raw.trim().replace(/^(?:[-+*]|[0-9]+[.)])\s+/, '');
  const claims = [];
  for (const clause of clauses(body)) {
    if (PREAMBLE.test(clause.quote)) break;
    if (!clause.retracted) claims.push(...claimsFromClause(clause.quote, line));
  }
  return claims;
}

const refKey = (ref) => `${ref.owner ?? ''}/${ref.repo ?? ''}#${ref.number}`.toLowerCase();

// References on read lines that gave no claim, once per line, in note order.
function unreadReferences(read, claims) {
  const claimed = new Set(claims.map((claim) => `${claim.line} ${refKey(claim.ref)}`));
  const unread = [];
  for (const { raw, line } of read) {
    for (const [token] of unquoted(raw).matchAll(MENTION)) {
      const ref = makeClaim(token, '', '', line)?.ref;
      const id = ref && `${line} ${refKey(ref)}`;
      if (!ref || claimed.has(id)) continue;
      claimed.add(id);
      unread.push({ line, ref });
    }
  }
  return unread;
}

function closes(lines, from, open) {
  let quote = open;
  for (let i = from; i < lines.length && quote !== null; i++) quote = endQuote(lines[i], quote);
  return quote === null;
}

// Aliases and the default repository are resolved by the reader. Preserve the
// identity written in the note, including refs that the reader cannot place.
export function extractClaims(text, options = {}) {
  const claims = [], read = [];
  let paragraph = [], fence = null, quote = null, comment = false, sections = [], frontMatter = false, titled = false, planned = null;
  const flush = (keepLabel = false) => {
    // Keep wrapped qualifiers and Markdown exclusions conservative, but unrelated
    // prose does not take back an otherwise complete claim on its own line.
    const blocks = (entry) => entry && !entry.claims.length && !entry.list &&
      (!entry.text || entry.indent > 0 || entry.colon ||
        PREAMBLE.test(entry.text) || PLANNED.test(entry.text) || UNCERTAIN.test(entry.text) ||
        NONSTATE.test(entry.text) || entry.text.split(/[(),;]/).some(isRetraction) || QUALIFIED_STATE.test(` ${entry.text}`) ||
        /^(?:and|but|not|never|no\s+longer)\b|\?/i.test(entry.text));
    // A historical label ("Old note:") covers the whole list under it.
    const old = paragraph.findIndex((entry) => !entry.list && !entry.claims.length && entry.label);
    paragraph.forEach((entry, i) => {
      // A planning list item covers the items nested under it, blank lines included.
      if (planned !== null && entry.indent <= planned) planned = null;
      const nested = planned !== null;
      if (!nested && entry.parent) planned = entry.indent;
      if (nested || (old >= 0 && i > old && entry.list)) return;
      const after = paragraph[i + 1]; // A planning item says nothing of the line before it.
      if (!blocks(paragraph[i - 1]) && (!blocks(after) || after.parent)) claims.push(...entry.claims);
    });
    // Quote boundaries separate claims without ending a historical label's scope.
    paragraph = keepLabel && old >= 0 ? [paragraph[old]] : [];
  };
  // The file's level 1 title above a current section does not switch it off.
  const readable = () => sections.every((section, i) => section.current || (section.title && i < sections.length - 1));
  const enterSection = (level, title, name = title) => {
    sections = sections.filter((section) => section.level < level);
    // Unknown headings may introduce plans, examples or history. Only a
    // current section (and current ancestors) permits extraction.
    sections.push({ level, current: CURRENT_HEADING.test(title), title: level === 1 && !titled && !/^(?:history|archive|old)\b/i.test(title) });
    titled ||= level === 1;
    if (!readable()) options.skipped?.push(name);
  };

  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  for (let [index, raw] of lines.entries()) {
    if (index === 0 && /^---\s*$/.test(raw)) {
      frontMatter = true;
      continue;
    }
    if (frontMatter) {
      if (/^(?:---|\.\.\.)\s*$/.test(raw)) frontMatter = false;
      continue;
    }
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(raw);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      continue;
    }
    // A comment closed on its own line leaves the text around it, so it cannot cost a planning item its scope.
    if (!comment) {
      const bare = raw.replace(/<!--.*?-->/g, '');
      if (bare !== raw && !bare.trim()) continue; // A comment alone on its line is not the blank line that ends a scope.
      raw = bare;
      if (quote === null && /^ {0,3}(?:(?:[-+*]|[0-9]+[.)])\s+)*>/.test(raw)) {
        // End the preceding paragraph, but keep an unmarked prose continuation quoted.
        flush(true);
        paragraph.push({ claims: [], list: false, indent: Infinity, blockquote: true });
        continue;
      }
    }
    if (comment || raw.includes('<!--')) {
      comment = !raw.includes('-->') || raw.lastIndexOf('<!--') > raw.lastIndexOf('-->');
      paragraph.push({ claims: [], list: false, indent: Infinity });
      continue;
    }
    // Fenced examples do not contain headings, even within a quotation.
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(raw);
    if (opening) {
      flush();
      fence = opening[1];
      continue;
    }
    const quoted = quote !== null;
    quote = endQuote(raw, quote);
    // A mark inside text that nothing closes was a stray.
    if (!quoted && quote !== null && raw.trim().length > 1 && !closes(lines, index + 1, quote)) quote = null;
    if (quoted || quote !== null) {
      // A heading inside a quote still changes the section the quote ends in.
      const inner = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(raw);
      const rule = /^ {0,3}(=+|-+)\s*$/.exec(raw);
      if (inner) enterSection(inner[1].length, inner[2]);
      else if (rule && lines[index - 1]?.trim()) enterSection(rule[1][0] === '=' ? 1 : 2, lines[index - 1].trim());
      paragraph.push({ claims: [], list: false, indent: Infinity });
      continue;
    }
    const heading = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(raw);
    const underline = /^ {0,3}(=+|-+)\s*$/.exec(raw);
    if (heading) {
      flush();
      enterSection(heading[1].length, heading[2]);
    } else if (underline && paragraph.length && !(underline[1][0] === '-' && paragraph.some((entry) => entry.item))) {
      const title = paragraph.map((entry) => entry.text).filter(Boolean).join(' ');
      // Preserve the conservative reading of multiline headings while naming them.
      const currentTitle = paragraph.length === 1 ? lines[index - 1].trim() : '';
      while (read.at(-1)?.line > index - paragraph.length) read.pop(); // Those lines were a heading after all.
      paragraph = [];
      enterSection(underline[1][0] === '=' ? 1 : 2, currentTitle, title);
    } else if (underline && paragraph.length) {
      flush(); // A rule after a list item, not a heading underline.
    } else if (!raw.trim()) {
      flush();
    } else {
      const claims = readable() ? claimsFromLine(raw, index + 1) : [];
      const body = raw.trim().replace(/^(?:[-+*]|[0-9]+[.)])\s+/, '');
      const label = /:\s*$/.test(raw) && PREAMBLE.test(body);
      const bare = body.replace(/[*_`]/g, '');
      const item = /^\s*(?:[-+*]|[0-9]+[.)])\s+/.test(raw);
      if (item && paragraph.at(-1)?.blockquote) flush(true); // A new list is not a quote continuation.
      if (readable() && !/^(?: {4}|\t)/.test(raw) && !paragraph.at(-1)?.blockquote) read.push({ raw, line: index + 1 });
      if (!item && paragraph.at(-1)?.blockquote) { // Every unmarked line of a quoted paragraph stays in the quote.
        paragraph.push({ claims: [], list: false, indent: Infinity, blockquote: true });
        continue;
      }
      const colon = /:\s*$/.test(bare);
      const parent = item && colon && PLANNED.test(bare);
      // A list item that opens a current list does not silence its first child.
      const list = item && (!colon || CURRENT_HEADING.test(bare));
      paragraph.push({ claims, list, item, label, parent, colon, text: raw.trim(), indent: /^\s*/.exec(raw)[0].length });
    }
  }
  flush();
  options.unread?.push(...unreadReferences(read, claims));
  return claims;
}
