import { readFile as fsRead } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { compare } from './compare.mjs';
import { readState, resolveRef } from './github.mjs';

const USAGE = 'usage: still-true NOTE.md [more.md] [--repo owner/name] [--alias Name=owner/name]';

export function repoFromRemote(url) {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\s*$/.exec(url ?? '');
  return m ? `${m[1]}/${m[2]}` : null;
}

export function parseArgs(argv) {
  const a = { files: [], aliases: {}, repo: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') a.repo = argv[++i];
    else if (argv[i] === '--alias') {
      const [name, full] = (argv[++i] ?? '').split('=');
      if (name && full) a.aliases[name] = full;
    } else a.files.push(argv[i]);
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
  if (!args.files.length) { out(USAGE); return 2; }
  const repo = args.repo ?? (typeof defaultRepo === 'function' ? defaultRepo() : defaultRepo);
  const seen = new Map();
  let checked = 0, contradicted = 0, looks = 0, unplaced = 0, failure = null;

  for (const file of args.files) {
    let text;
    try { text = await readFile(file, 'utf8'); }
    catch (e) { out(`${file}: cannot read: ${e.message}`); return 2; }
    for (const claim of extract(text, { aliases: args.aliases })) {
      const ref = resolveRef(claim.ref, { defaultRepo: repo, aliases: args.aliases });
      if (!ref) {
        unplaced++;
        const hint = claim.ref.repo ? `--alias ${claim.ref.repo}=owner/name` : '--repo owner/name';
        out(`${file}:${claim.line}  not checked: ${name(claim.ref)} (use ${hint})`);
        continue;
      }
      let real;
      try {
        if (!seen.has(key(ref))) seen.set(key(ref), await read(ref, { token }));
        real = seen.get(key(ref));
      } catch (e) { failure = e.message; break; }
      const r = compare(claim, real);
      if (r.verdict === 'unknown') {
        unplaced++;
        out(`${file}:${claim.line}  not checked: ${name(ref)} (GitHub has no such issue, or it is private)`);
        continue;
      }
      checked++;
      const when = real.at ? ` ${real.at.slice(0, 10)}` : '';
      if (r.verdict === 'look') {
        looks++;
        out(`${file}:${claim.line}  look: waits on ${name(ref)}, which is ${real.state}${when}  ${real.url}`);
        out(`  "${claim.quote}"`);
      } else if (r.verdict === 'contradicted') {
        contradicted++;
        out(`${file}:${claim.line}  said ${claim.said}, but ${name(ref)} is ${real.state}${when}  ${real.url}`);
        out(`  "${claim.quote}"`);
      }
    }
    if (failure) break;
  }

  if (failure) {
    out(`stopped: ${failure}`);
    out('This run is not complete. Set GITHUB_TOKEN for a higher rate limit, or try again later.');
    // Node's fetch ignores proxy settings unless told otherwise.
    if ((env.HTTPS_PROXY ?? env.https_proxy) && !env.NODE_USE_ENV_PROXY) out('You have a proxy set: run again with NODE_USE_ENV_PROXY=1.');
    return contradicted ? 1 : 2;
  }
  if (!checked && !unplaced) { out('no claims about PR or issue state found'); return 0; }
  const note = (looks ? `, ${looks} to look at` : '') + (unplaced ? `, ${unplaced} not checked` : '');
  out(`${checked} claim${checked === 1 ? '' : 's'} checked, ${contradicted} contradicted${note}`);
  return contradicted ? 1 : 0;
}

export { readState };
