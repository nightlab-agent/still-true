// Decides one claim against what GitHub says. Only a real disagreement is "contradicted".
// A wait or queued review on something finished is a "look": work may remain after closure.
export function compare(claim, real) {
  if (!real) return { verdict: 'unknown', claim };
  const { said } = claim;
  const { state, kind } = real;
  let ok;
  if (said === 'open') ok = state === 'open';
  else if (said === 'closed') ok = state === 'closed' || state === 'merged';
  else if (said === 'merged') ok = state === 'merged' || (kind === 'issue' && state === 'closed');
  else if (said === 'waiting' || said === 'queued') return { verdict: state === 'open' ? 'ok' : 'look', claim, real };
  else return { verdict: 'unknown', claim, real };
  return { verdict: ok ? 'ok' : 'contradicted', claim, real };
}
