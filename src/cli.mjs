import { readFile as fsRead } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { compare } from './compare.mjs';
import { readState, resolveRef } from './github.mjs';

const USAGE = 'usage: still-true NOTE.md [more.md] [--repo owner/name] [--alias Name=owner/name] [--json] [--strict]';
const JSON_HELP = '--json: print one JSON object (schema 1) with completeness, counts and every extracted claim.';
const STRICT_HELP = '--strict: exit 3 if any note had no claim to verify, or if any claim could not be checked. Use it when a green run has to mean the note was really read.';
const EXIT_HELP = 'exit 0: nothing contradicted, look lines may have printed\nexit 1: at least one contradiction\nexit 2: bad usage, or an unreadable file or failed read before any contradiction; the run is not complete\nexit 3: with --strict only, nothing was verified or a claim was not checked';

export function repoFromRemote(url) {
  const m = /^(?:[a-z+]+:\/\/(?:[^@/\s]+@)?|[^@/\s]+@)?(?:www\.)?github\.com(?::\d+)?[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?\s*$/i.exec(url ?? '');
  return m ? `${m[1]}/${m[2]}` : null;
}

const FULL = /^[^/\s=]+\/[^/\s=]+$/;

export function parseArgs(argv) {
  const a = { files: [], aliases: {}, repo: undefined, bad: null, json: argv.includes('--json'), strict: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') {
      a.repo = argv[++i];
      if (!FULL.test(a.repo ?? '')) a.bad ??= '--repo needs owner/name';
    } else if (argv[i] === '--alias') {
      const [name, full, more] = (argv[++i] ?? '').split('=');
      if (name && FULL.test(full ?? '') && more === undefined) a.aliases[name] = full;
      else a.bad ??= '--alias needs Name=owner/name';
    } else if (argv[i] === '--strict') a.strict = true;
    else if (argv[i] !== '--json') a.files.push(argv[i]);
  }
  return a;
}

function originRepo() {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  return r.status === 0 ? repoFromRemote(r.stdout) : null;
}

const key = (r) => `${r.owner}/${r.repo}#${r.number}`.toLowerCase();
const name = (ref) => (ref.owner ? `${ref.owner}/${ref.repo}#${ref.number}` : ref.repo ? `${ref.repo}#${ref.number}` : `#${ref.number}`);

export async function run(argv, deps) {
  const { out, extract, readFile = fsRead, read, token, defaultRepo = originRepo, env = process.env } = deps;
  const args = parseArgs(argv);
  const print = (line) => { if (!args.json) out(line); };
  const entries = [];
  let checked = 0, contradicted = 0, looks = 0, unplaced = 0, failure = null;
  const finish = (code, reason = null, extra = {}) => {
    if (args.json) out(JSON.stringify({
      schema: 1, complete: reason === null, reason,
      counts: { checked, contradicted, looks, notChecked: entries.length - checked },
      claims: entries, ...extra,
    }));
    return code;
  };
  if (argv.includes('--help')) {
    print(USAGE); print(JSON_HELP); print(STRICT_HELP); print(EXIT_HELP);
    return finish(0, null, { help: `${USAGE}\n${JSON_HELP}\n${STRICT_HELP}\n${EXIT_HELP}` });
  }
  const odd = args.files.find((f) => f.startsWith('--'));
  if (odd) { print(`unknown option ${odd}`); print(USAGE); return finish(2, `unknown option ${odd}`); }
  if (args.bad) { print(args.bad); print(USAGE); return finish(2, args.bad); }
  if (!args.files.length) { print(USAGE); return finish(2, USAGE); }
  const seen = new Map();
  const skipped = [];
  const unread = [];

  try {
    const repo = args.repo ?? (typeof defaultRepo === 'function' ? defaultRepo() : defaultRepo);
    for (const file of args.files) {
      let text;
      try { text = await readFile(file, 'utf8'); }
      catch (e) {
        const reason = `${file}: cannot read: ${e instanceof Error ? e.message : String(e)}`;
        print(reason);
        print('This run is not complete.');
        return finish(contradicted ? 1 : 2, reason);
      }
      // Record all claims in this file before reading GitHub, including those a failure may leave unchecked.
      const here = [];
      const claims = extract(text, { aliases: args.aliases, skipped: here }).map((claim) => {
        const ref = resolveRef(claim.ref, { defaultRepo: repo, aliases: args.aliases });
        const entry = args.json ? {
          file, line: claim.line, reference: name(ref ?? claim.ref), said: claim.said,
          actual: null, kind: 'not checked',
        } : null;
        if (entry) entries.push(entry);
        return { claim, ref, entry };
      });
      if (!claims.length) unread.push(file);
      skipped.push(...here.map((section) => (args.files.length > 1 ? `${file}: ${section}` : section)));
      for (const { claim, ref, entry } of claims) {
        if (!ref) {
          unplaced++;
          const hint = claim.ref.repo ? `--alias ${claim.ref.repo}=owner/name` : '--repo owner/name';
          print(`${file}:${claim.line}  not checked: ${name(claim.ref)} (use ${hint})`);
          continue;
        }
        let real;
        try {
          if (!seen.has(key(ref))) seen.set(key(ref), await read(ref, { token }));
          real = seen.get(key(ref));
        } catch (e) { failure = e instanceof Error ? e.message : String(e); break; }
        const r = compare(claim, real);
        if (entry) {
          entry.actual = real?.state ?? null;
          entry.kind = r.verdict === 'contradicted' ? 'contradiction' : r.verdict === 'unknown' ? 'not checked' : r.verdict;
          if (real?.url) entry.url = real.url;
          if (real?.state_reason) entry.state_reason = real.state_reason;
        }
        if (r.verdict === 'unknown') {
          unplaced++;
          print(`${file}:${claim.line}  not checked: ${name(ref)} (GitHub has no such issue, or it is private)`);
          continue;
        }
        checked++;
        const when = real.at ? ` ${real.at.slice(0, 10)}` : '';
        const reason = real.state_reason ? ` (${real.state_reason})` : '';
        if (r.verdict === 'look') {
          looks++;
          const action = claim.said === 'queued' ? 'queued work on' : 'waits on';
          print(`${file}:${claim.line}  look: ${action} ${name(ref)}, which is ${real.state}${reason}${when}  ${real.url}`);
          print(`  "${claim.quote}"`);
        } else if (r.verdict === 'contradicted') {
          contradicted++;
          print(`${file}:${claim.line}  said ${claim.said}, but ${name(ref)} is ${real.state}${reason}${when}  ${real.url}`);
          print(`  "${claim.quote}"`);
        }
      }
      if (failure !== null) break;
    }
  } catch (e) { failure = e instanceof Error ? e.message : String(e); }

  if (failure !== null) {
    print(`stopped: ${failure}`);
    print('This run is not complete.');
    if (/rate limit/i.test(failure)) print('Set GITHUB_TOKEN for a higher rate limit, or try again later.');
    // Node's fetch ignores proxy settings unless told otherwise.
    if ((env.HTTPS_PROXY ?? env.https_proxy) && !env.NODE_USE_ENV_PROXY) print('You have a proxy set: run again with NODE_USE_ENV_PROXY=1.');
    return finish(contradicted ? 1 : 2, failure);
  }
  const strictFail = (extra = {}) => {
    const why = [];
    if (unplaced) why.push(`${unplaced} claim${unplaced === 1 ? '' : 's'} not checked`);
    if (unread.length) why.push(`nothing was verified in ${unread.join(', ')}`);
    print(`--strict: ${why.join(', ')}`);
    return finish(3, null, { ...extra, strict_failed: true });
  };
  if (!checked && !unplaced) {
    print('no claims about PR or issue state found');
    if (!skipped.length) return args.strict ? strictFail() : finish(0);
    print(`skipped ${skipped.length} section${skipped.length === 1 ? '' : 's'}: ${skipped.join(', ')}. A section is read only if its heading, and every heading above it, apart from the file's title, starts with Now, Handoff, State, Status or Current.`);
    return args.strict ? strictFail({ skipped_sections: skipped }) : finish(0, null, { skipped_sections: skipped });
  }
  const note = (looks ? `, ${looks} to look at` : '') + (unplaced ? `, ${unplaced} not checked` : '');
  print(`${checked} claim${checked === 1 ? '' : 's'} checked, ${contradicted} contradicted${note}`);
  if (contradicted) return finish(1);
  return args.strict && (unplaced || unread.length) ? strictFail() : finish(0);
}

export { readState };
