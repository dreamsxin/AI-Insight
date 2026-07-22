/** Color utilities for Canvas visualizations. */

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** Map a value in [0, 1] to a blue-to-red heatmap color. */
export function heatmap(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Blue -> cyan -> green -> yellow -> red
  const h = (1 - clamped) * 240;
  return hsl(h, 80, 55);
}

/** Map a value in [valMin, valMax] to a heatmap color string. */
export function heatmapRange(val: number, valMin: number, valMax: number): string {
  if (valMax === valMin) return heatmap(0.5);
  return heatmap((val - valMin) / (valMax - valMin));
}

/** Blend two hex colors. */
export function blend(c1: string, c2: string, t: number): string {
  const p1 = parseHex(c1);
  const p2 = parseHex(c2);
  const r = Math.round(p1.r + (p2.r - p1.r) * t);
  const g = Math.round(p1.g + (p2.g - p1.g) * t);
  const b = Math.round(p1.b + (p2.b - p1.b) * t);
  return `rgb(${r},${g},${b})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.substring(0, 2), 16),
    g: parseInt(m.substring(2, 4), 16),
    b: parseInt(m.substring(4, 6), 16),
  };
}

/** Theme colors for the application. */
export const COLORS = {
  bg: "#1a1a2e",
  bgLight: "#16213e",
  panel: "#0f3460",
  accent: "#00d9ff",
  accent2: "#a78bfa",
  accent3: "#f97316",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  positive: "#22c55e",
  negative: "#ef4444",
  node: "#00d9ff",
  edge: "#475569",
  highlight: "#fbbf24",
} as const;
