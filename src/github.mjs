// Reads one issue or PR. The issues endpoint answers for both, so each ref is one request.
const API = 'https://api.github.com';

export function resolveRef(ref, { defaultRepo, aliases = {} } = {}) {
  if (ref.owner) return ref;
  let full = defaultRepo;
  if (ref.repo) {
    const short = ref.repo.toLowerCase();
    if (Object.hasOwn(aliases, ref.repo)) full = aliases[ref.repo];
    else {
      const matches = Object.entries(aliases).filter(([name]) => name.toLowerCase() === short);
      full = matches[0]?.[1];
      // A new spelling must not choose between aliases for different repositories.
      if (matches.some(([, target]) => target.toLowerCase() !== full.toLowerCase())) return null;
    }
    full ??= defaultRepo?.split('/')[1]?.toLowerCase() === short ? defaultRepo : null;
  }
  if (!full) return null;
  const [owner, repo] = full.split('/');
  return { owner, repo, number: ref.number };
}

// GitHub sends 2026-11-24T18:00:00Z. Date.parse alone also takes "foo 1" and rolls February 31 over.
function isUtcTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19);
}

export async function readState({ owner, repo, number }, { fetchFn = fetch, token } = {}) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'still-true' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetchFn(`${API}/repos/${owner}/${repo}/issues/${number}`, { headers });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GitHub answered ${res.status} for ${owner}/${repo}#${number}: ${body.message ?? 'no reason given'}`);
  }
  const d = await res.json();
  if (d.state !== 'open' && d.state !== 'closed') throw new Error(`GitHub gave no state for ${owner}/${repo}#${number}`);
  const url = d.html_url;
  const reason = typeof d.state_reason === 'string' && d.state_reason ? { state_reason: d.state_reason } : {};
  if (d.pull_request) {
    const merged = d.pull_request.merged_at;
    // A closed PR can be merged or unmerged; an absent merge time does not distinguish them.
    const mergeKnown = merged === null || isUtcTimestamp(merged);
    if (!mergeKnown && (d.state === 'closed' || merged !== undefined)) {
      throw new Error(`GitHub gave no merge state for ${owner}/${repo}#${number}`);
    }
    if (merged) return { state: 'merged', kind: 'pull', at: merged, url, ...reason };
    return { state: d.state, kind: 'pull', at: d.closed_at ?? d.updated_at ?? null, url, ...reason };
  }
  return { state: d.state, kind: 'issue', at: d.closed_at ?? d.created_at ?? null, url, ...reason };
}
