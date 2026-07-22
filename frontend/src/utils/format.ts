/** Formatting utilities. */

export function fmtNum(n: number, decimals = 2): string {
  if (Math.abs(n) < 1e-4) return "0";
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  return n.toFixed(decimals);
}

export function fmtPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.substring(0, maxLen - 1) + "…" : s;
}
