// Deliberately limited to standalone state assertions, not general prose.
const STATEMENT = /^(?:(?:PR|issue|pull request)\s+)?(\S+?)(?:\s+(?:(?:is(?:\s+(?:still|currently|now))?|remains|still|currently)\s+)?|:\s*)(open|merged|closed)(?:\s+now)?[.!]?$/i;
const REF = /^(?:([a-z0-9-]+)\/)?([a-z0-9_.-]+)?#([1-9][0-9]*)$/i;
const CURRENT_HEADING = /^(?:handoff|state|status|now|current(?: status| state)?)$/i;

function endQuote(raw, quote) {
  const pairs = { '"': '"', "'": "'", '“': '”', '‘': '’' };
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (quote) {
      const apostrophe = /['’]/.test(char) && /[\p{L}\p{N}]/u.test(raw[i - 1] ?? '') && /[\p{L}\p{N}]/u.test(raw[i + 1] ?? '');
      if (char === quote && !apostrophe) quote = null;
    } else if (Object.hasOwn(pairs, char) && !/[\p{L}\p{N}_]/u.test(raw[i - 1] ?? '')) {
      quote = pairs[char];
    }
  }
  return quote;
}

function claimFromLine(raw, line) {
  if (/^(?: {4}|\t)/.test(raw)) return null;
  const quote = raw.trim().replace(/^(?:[-+*]|[0-9]+[.)])\s+/, '');
  const statement = STATEMENT.exec(quote);
  if (!statement) return null;
  const parts = REF.exec(statement[1]);
  if (!parts) return null;
  const [, owner, repo, digits] = parts;
  const number = Number(digits);
  if (!Number.isSafeInteger(number) || (owner && !repo)) return null;
  const ref = owner ? { owner, repo, number } : repo ? { repo, number } : { number };
  return { line, ref, said: statement[2].toLowerCase(), quote: [...quote].slice(0, 160).join('') };
}

// Aliases and the default repository are resolved by the reader. Preserve the
// identity written in the note, including refs that the reader cannot place.
export function extractClaims(text, _options = {}) {
  const claims = [];
  let paragraph = [], fence = null, quote = null, comment = false, sections = [];
  const flush = () => {
    // A wrapped condition, quotation or historical preamble can change the
    // following line. Separate list items may contain independent nonclaims.
    if (paragraph.every((entry) => entry.claim || entry.list)) {
      for (const { claim } of paragraph) if (claim) claims.push(claim);
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
      paragraph.push({ claim: null, list: false });
      continue;
    }
    const quoted = quote !== null;
    quote = endQuote(raw, quote);
    if (quoted || quote !== null) {
      paragraph.push({ claim: null, list: false });
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
      const claim = sections.every((section) => section.current) ? claimFromLine(raw, index + 1) : null;
      const list = /^ {0,3}(?:[-+*]|[0-9]+[.)])\s+/.test(raw) && !/:\s*$/.test(raw);
      paragraph.push({ claim, list });
    }
  }
  flush();
  return claims;
}
