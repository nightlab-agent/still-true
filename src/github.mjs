// Reads one issue or PR. The issues endpoint answers for both, so each ref is one request.
const API = 'https://api.github.com';

export function resolveRef(ref, { defaultRepo, aliases = {} } = {}) {
  if (ref.owner) return ref;
  const full = ref.repo
    ? aliases[ref.repo] ?? (defaultRepo?.split('/')[1] === ref.repo ? defaultRepo : null)
    : defaultRepo;
  if (!full) return null;
  const [owner, repo] = full.split('/');
  return { owner, repo, number: ref.number };
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
  const url = d.html_url;
  if (d.pull_request) {
    const merged = d.pull_request.merged_at;
    if (merged) return { state: 'merged', kind: 'pull', at: merged, url };
    return { state: d.state, kind: 'pull', at: d.closed_at ?? d.updated_at ?? null, url };
  }
  return { state: d.state, kind: 'issue', at: d.closed_at ?? d.created_at ?? null, url };
}
