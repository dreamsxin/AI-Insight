/** Math utilities for AI visualizations. */

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function relu(x: number): number {
  return Math.max(0, x);
}

export function tanh(x: number): number {
  return Math.tanh(x);
}

export function step(x: number): number {
  return x > 0 ? 1 : 0;
}

export function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Matrix multiplication: A[m][n] * B[n][p] = C[m][p]. */
export function matmul(a: number[][], b: number[][]): number[][] {
  const m = a.length;
  const n = a[0].length;
  const p = b[0].length;
  const result: number[][] = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value to [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Map a value from one range to another. */
export function mapRange(
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, (x - inMin) / (inMax - inMin));
}

/** Generate a pseudo-random number in [0, 1) with a seedable RNG. */
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ActivationFn = (x: number) => number;

export const ACTIVATIONS: Record<string, ActivationFn> = {
  relu,
  sigmoid,
  tanh,
  step,
};
