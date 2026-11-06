// Recognize explicit assertions and a small set of handoff status forms.
const STATEMENT = /^(?:(?:PR|issue|pull request)\s+)?(\S+?)(?:\s+(?:(?:is(?:\s+(?:still|currently|now))?|remains|still|currently)\s+)?|:\s*)(open|merged|closed)(?:\s+now)?[.!]?$/i;
const REF = /^(?:([a-z0-9-]+)\/)?([a-z0-9_.-]+)?#([1-9][0-9]*)$/i;
const CURRENT_HEADING = /^(?:handoff|state|status|now|current)\b(?!-)/i;
const LABEL = /^(?:open PRs(?: followed up)?|replies(?: check)?|status|now):\s*/i;
const METADATA = /^(?:,\s*(?:clean|mergeable clean|head [a-f0-9]+|no change since \d{2}:\d{2}Z|\d+ (?:comments|reactions)|unassigned|released as \d[\w.-]*(?: with our credit)?))*$/i;
const PREAMBLE = /^(?:if|unless|when|yesterday|old note|example|suppose|imagine)\b/i;
const UNCERTAIN = /\b(?:probably|maybe|might|should|could|would|if|unless)\b/i;

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

function claimFromClause(quote, line) {
  const statement = STATEMENT.exec(quote);
  if (statement) return makeClaim(statement[1], statement[2], quote, line);
  if (quote.includes('?') || UNCERTAIN.test(quote)) return null;
  let body = quote.replace(/[.!]$/, '').replace(LABEL, '');
  // A status inside a trailing parenthesis still names its own subject.
  const parenthetical = /^[\w.-]+ has no [\w ]+ \(([^()]+)\)$/.exec(body);
  if (parenthetical) body = parenthetical[1];
  // The dependency can follow an update about a different PR. Capture only
  // the target of an explicit wait, never infer a state for the earlier ref.
  const waiting = /(?:^|,\s*)(?:waits?|waiting)\s+(?:on|for)\s+(\S+?)(?:\s+(?:to merge|for a response))?$/i.exec(body);
  if (waiting) return makeClaim(waiting[1], 'waiting', quote, line);
  const refs = [...body.matchAll(/[a-z0-9_./-]*#[a-z0-9_.-]+/gi)];
  if (!refs.length) return null;
  const [subject] = refs;
  const before = body.slice(0, subject.index).trim();
  const after = body.slice(subject.index + subject[0].length).trim();
  if (!/^(?:PR|issue|pull request|\d+ threads? updated,)?$/i.test(before)) return null;
  if (refs.length === 1 && /^(?:['’]s held CI\s+)?waits on (?:its|the) maintainer(?:, nothing to push)?$/i.test(after)) {
    return makeClaim(subject[0], 'waiting', quote, line);
  }
  // A duplicate target is an object of the closure reason, not another claim.
  const duplicate = /^closed by (?:its|the) maintainer as a duplicate of (\S+)$/i.exec(after);
  if (duplicate && refs.length === 2 && REF.test(duplicate[1])) return makeClaim(subject[0], 'closed', quote, line);
  if (refs.length !== 1) return null;
  // A dated merge records the completed transition, including retrospective notes.
  if (/^(?:was )?merged \d{2}-\d{2}(?: \d{2}:\d{2})?(?: and .+)?$/i.test(after)) {
    return makeClaim(subject[0], 'merged', quote, line);
  }
  // In a parenthesis, a capitalized issue title can precede the status.
  const statusText = parenthetical ? after.replace(/^(?:[A-Z][\w-]*\s+)+(?=(?:open|merged|closed)\b)/, '') : after;
  const status = /^(?:(?:is(?:\s+(?:still|currently|now))?|remains|still|currently)\s+|:\s*|re-checked:\s*|,\s*no new comment or review,\s*)?(open|merged|closed)(.*)$/i.exec(statusText);
  if (!status) return null;
  const metadata = status[2].replace(/^ \d{2}:\d{2}Z/i, '');
  return METADATA.test(metadata) ? makeClaim(subject[0], status[1], quote, line) : null;
}

function claimsFromLine(raw, line) {
  if (/^(?: {4}|\t)/.test(raw)) return [];
  const body = raw.trim().replace(/^(?:[-+*]|[0-9]+[.)])\s+/, '');
  const claims = [];
  for (const clause of clauses(body)) {
    if (PREAMBLE.test(clause)) break;
    const claim = claimFromClause(clause, line);
    if (claim) claims.push(claim);
  }
  return claims;
}

// Aliases and the default repository are resolved by the reader. Preserve the
// identity written in the note, including refs that the reader cannot place.
export function extractClaims(text, _options = {}) {
  const claims = [];
  let paragraph = [], fence = null, quote = null, comment = false, sections = [];
  const flush = () => {
    // A wrapped condition, quotation or historical preamble can change the
    // following line. Separate list items may contain independent nonclaims.
    if (paragraph.every((entry) => entry.claims.length || entry.list)) {
      for (const entry of paragraph) claims.push(...entry.claims);
    }
    paragraph = [];
  };
  const enterSection = (level, title) => {
    sections = sections.filter((section) => section.level < level);
    // Unknown headings may introduce plans, examples or history. Only a
    // current section (and current ancestors) permits extraction.
    sections.push({ level, current: CURRENT_HEADING.test(title) });
  };

  const lines = text.split(/\r\n|\n|\r/);
  for (const [index, raw] of lines.entries()) {
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
      const claims = sections.every((section) => section.current) ? claimsFromLine(raw, index + 1) : [];
      const list = /^ {0,3}(?:[-+*]|[0-9]+[.)])\s+/.test(raw) && !/:\s*$/.test(raw);
      paragraph.push({ claims, list });
    }
  }
  flush();
  return claims;
}
