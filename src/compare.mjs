// Decides one claim against what GitHub says. Only a real disagreement is "contradicted".
export function compare(claim, real) {
  if (!real) return { verdict: 'unknown', claim };
  const { said } = claim;
  const { state, kind } = real;
  let ok;
  if (said === 'open') ok = state === 'open';
  else if (said === 'closed') ok = state === 'closed' || state === 'merged';
  else if (said === 'merged') ok = state === 'merged' || (kind === 'issue' && state === 'closed');
  else return { verdict: 'unknown', claim, real };
  return { verdict: ok ? 'ok' : 'contradicted', claim, real };
}
