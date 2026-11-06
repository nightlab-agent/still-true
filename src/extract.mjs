// Six grammar rules, shared by bare statements, labelled lists and fact fields.
const TOKEN = '[a-z0-9_./-]*#[a-z0-9_.-]+';
const HAS_REF = new RegExp(TOKEN, 'i');
const SUBJECT = new RegExp(`^((?:[^#]*\\s)?)(${TOKEN}(?:\\s+and\\s+${TOKEN})*)(.*)$`, 'i');
const STATE = /^(?:(?:is(?:\s+(?:still|currently|now))?|remains|still|currently|already|was(?=\s+merged\b)|(?:PR|issue)(?:\s+is)?)\s+)?(open|merged|closed)\b(?!-)(.*)$/i;
const BEFORE_REF = new RegExp(`(?<![\\w-])\\b(open|merged|closed)\\s+((?:PR|issue|pull request)\\s+)?(${TOKEN})(.*)$`, 'i');
const COUNT_STATE = /^\d+\s+(open|merged|closed)$/i;
const WAIT = new RegExp(`(?:^|\\s)(?:waits?|waiting)\\s+(?:on|for)\\s+(${TOKEN}|(?:its|the) maintainer)(?:\\s+(?:to merge|for a response))?$`, 'i');
const LABEL_LIST = new RegExp(`(?:^|:\\s*)(open|merged|closed)(?:\\s+(?:PRs|issues|pull requests))?:\\s*(${TOKEN}(?:\\s*(?:,|and)\\s*${TOKEN})*)$`, 'i');

const REF = /^(?:([a-z0-9-]+)\/)?([a-z0-9_.-]+)?#([1-9][0-9]*)$/i;
const CURRENT_HEADING = /^(?:handoff|state|status|now|current)\b(?!-)/i;
const PREAMBLE = /^(?:if|unless|once|after|when|until|yesterday|old note|example|suppose|imagine)\b/i;
const UNCERTAIN = /\b(?:probably|maybe|might|should|could|would|if|unless|when|until|need|get|think|believe|locally|re-?opened)\b|\bonce\s+(?!at\b)\S|n['’]t\b|\bby\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|next)\b/i;
const NONSTATE = /\b(?:(?:not|never|no longer)\s+(?:(?:yet|still|currently|already)\s+)?(?:open|merged|closed)|(?:was|were|used to be)\s+(?:(?:still|currently|already)\s+)?(?:open|closed)|(?:open|merged|closed)\s+or\s+(?:open|merged|closed))\b/i;
const QUALIFIED_STATE = /^\s+(?:to|into|for|or|after)\b/i;
// A later comma field must look like a state fact, not "open question".
const COMMA_STATE_TAIL = /^(?:$|\s+(?:\d|today\b|yesterday\b|last\b|since\b|by\b|as\s+a\s+duplicate\b))/i;
// An initial "open PR" needs a predicate to distinguish it from a command.
const OPEN_PREDICATE = /^\s+(?:is|has|needs|touches)\b/i;
const OPEN_POSSESSIVE = /(?:['’]s|\b(?:my|our|your|their|his|her|its))\s*$/i;
// Subjects may have a noun label or a possessive determiner, but objects of
// phrases such as "a PR for issue #12" are not the subject of that PR's state.
const SUBJECT_PREFIX = /^(?:(?:PR|issue|pull request)|(?:[\w'-]+\s+)+(?:PR|issue|pull request)|(?:the\s+)?[\w-]+['’]s|(?:my|our|your|their|his|her|its)(?:\s+own)?)?$/i;
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
      result.push(raw.slice(start, char === ';' ? i : i + 1).trim());
      start = i + 1;
    }
  }
  result.push(raw.slice(start).trim());
  return result.filter(Boolean);
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

function claimsFromClause(quote, line) {
  const body = unquoted(quote);
  if (!body.includes('#') || body.includes('?') || UNCERTAIN.test(body) || NONSTATE.test(body)) return [];
  const claims = [];
  const add = (tokens, said) => {
    for (const token of tokens) {
      const claim = makeClaim(token, said, quote, line);
      if (claim && !claims.some((c) => c.said === claim.said &&
        c.ref.owner === claim.ref.owner && c.ref.repo === claim.ref.repo && c.ref.number === claim.ref.number)) claims.push(claim);
    }
  };
  const labelled = LABEL_LIST.exec(body.trim().replace(/[.!]$/, ''));
  if (labelled) add([...labelled[2].matchAll(new RegExp(TOKEN, 'gi'))].map((m) => m[0]), labelled[1]);
  let context = { subjects: [], list: false, label: false, state: null, hadRef: false };
  const stack = [];
  let afterComma = false;
  // Commas separate fact fields; parentheses save and restore subject scope.
  for (const field of body.matchAll(/([^(),:]*)([(),:]|$)/g)) {
    const text = field[1].trim().replace(/[.!]$/, '');
    const delimiter = field[2];
    const bareState = STATE.exec(text);
    const subject = bareState ? null : SUBJECT.exec(text);
    let tail = text;
    if (subject) {
      context.hadRef = true;
      const prefix = subject[1].trim();
      const tokens = subject[2].split(/\s+and\s+/i);
      if (SUBJECT_PREFIX.test(prefix) && !OBJECT_PREFIX.test(prefix) &&
          (tokens.length === 1 || context.label || context.state)) {
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
    if (state && !QUALIFIED_STATE.test(state[2]) &&
        (!bareState || !afterComma || COMMA_STATE_TAIL.test(state[2]))) {
      add(context.subjects, state[1]);
      context.list = false;
    }
    const waiting = WAIT.exec(tail);
    if (waiting) add(REF.test(waiting[1]) ? [waiting[1]] : context.subjects, 'waiting');
    const before = BEFORE_REF.exec(text);
    if (before && (!subject || before.index < subject[1].length) &&
        (before[1].toLowerCase() !== 'open' || (before[2] &&
          (OPEN_POSSESSIVE.test(text.slice(0, before.index)) || OPEN_PREDICATE.test(before[4])))) &&
        !QUALIFIED_STATE.test(before[4])) add([before[3]], before[1]);
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
        state: count ? count[1] : null, hadRef: false };
    } else if (delimiter === ')' && stack.length) {
      const child = context;
      context = stack.pop();
      // A ref inside parentheses interrupts the inherited subject's fact chain.
      if (child.hadRef) { context.subjects = []; context.list = false; context.hadRef = true; }
    }
    afterComma = delimiter === ',';
  }
  return claims;
}

function claimsFromLine(raw, line) {
  if (/^(?: {4}|\t)/.test(raw)) return [];
  const body = raw.trim().replace(/^(?:[-+*]|[0-9]+[.)])\s+/, '');
  const claims = [];
  for (const clause of clauses(body)) {
    if (PREAMBLE.test(clause)) break;
    claims.push(...claimsFromClause(clause, line));
  }
  return claims;
}

// Aliases and the default repository are resolved by the reader. Preserve the
// identity written in the note, including refs that the reader cannot place.
export function extractClaims(text, _options = {}) {
  const claims = [];
  let paragraph = [], fence = null, quote = null, comment = false, sections = [], frontMatter = false;
  const flush = () => {
    // A wrapped condition, quotation or historical preamble can change the
    // following line. Separate list items may contain independent nonclaims.
    const blocks = (entry) => entry && !entry.claims.length && !entry.list;
    // A historical label ("Old note:") covers the whole list under it.
    const old = paragraph.findIndex((entry) => !entry.list && !entry.claims.length && entry.label);
    paragraph.forEach((entry, i) => {
      if (old >= 0 && i > old && entry.list) return;
      if (!blocks(paragraph[i - 1]) && !blocks(paragraph[i + 1])) claims.push(...entry.claims);
    });
    paragraph = [];
  };
  const enterSection = (level, title) => {
    sections = sections.filter((section) => section.level < level);
    // Unknown headings may introduce plans, examples or history. Only a
    // current section (and current ancestors) permits extraction.
    sections.push({ level, current: CURRENT_HEADING.test(title) });
  };

  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  for (const [index, raw] of lines.entries()) {
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
    if (comment || raw.includes('<!--')) {
      comment = !raw.includes('-->') || raw.lastIndexOf('<!--') > raw.lastIndexOf('-->');
      paragraph.push({ claims: [], list: false });
      continue;
    }
    const quoted = quote !== null;
    quote = endQuote(raw, quote);
    if (quoted || quote !== null) {
      paragraph.push({ claims: [], list: false });
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(raw);
    const heading = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(raw);
    const underline = /^ {0,3}(=+|-+)\s*$/.exec(raw);
    if (opening) {
      flush();
      fence = opening[1];
    } else if (heading) {
      flush();
      enterSection(heading[1].length, heading[2]);
    } else if (underline && paragraph.length) {
      const title = paragraph.length === 1 ? lines[index - 1].trim() : '';
      paragraph = [];
      enterSection(underline[1][0] === '=' ? 1 : 2, title);
    } else if (!raw.trim()) {
      flush();
    } else {
      // A level 1 title above a current section does not switch it off.
      const readable = sections.every((section, i) => section.current || (section.level === 1 && i < sections.length - 1));
      const claims = readable ? claimsFromLine(raw, index + 1) : [];
      const list = /^ {0,3}(?:[-+*]|[0-9]+[.)])\s+/.test(raw) && !/:\s*$/.test(raw);
      const label = /:\s*$/.test(raw) && PREAMBLE.test(raw.trim().replace(/^(?:[-+*]|[0-9]+[.)])\s+/, ''));
      paragraph.push({ claims, list, label });
    }
  }
  flush();
  return claims;
}
