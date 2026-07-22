/** Color mapping utilities for visualizing values as brightness/color.

Maps a normalized intensity (0-1) to a color that intuitively reads as
"brighter = more active", following the nn_vis dark-colormap philosophy.

The ramp goes: dark navy -> blue -> cyan -> green -> bright white-green,
so low values are nearly invisible (dark) and high values glow brightly.
*/

/** Map intensity [0,1] to an HSL color string. */
export function colormap(intensity: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, intensity));
  // Hue: 240 (blue) -> 180 (cyan) -> 120 (green) as intensity increases
  const hue = 240 - t * 120;
  // Lightness: 10% (dark) -> 65% (bright) as intensity increases
  const light = 10 + t * 55;
  // Saturation drops at very high values for a "white hot" look
  const sat = 90 - t * 20;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}

/** Get the hue value (0-360) for an intensity, for use with GlowNode. */
export function colormapHue(intensity: number): number {
  const t = Math.max(0, Math.min(1, intensity));
  return 240 - t * 120;
}

/** Map an absolute value within [min, max] to a colormap color. */
export function colormapRange(val: number, min: number, max: number, alpha = 1): string {
  if (max === min) return colormap(0.5, alpha);
  return colormap((val - min) / (max - min), alpha);
}

/**
 * Normalize an array of values to [0, 1] using per-layer min-max.
 * This mirrors nn_vis's `normalizeWithinLayer()` so faint activations
 * remain visible in every layer.
 */
export function normalizeLayer(values: number[]): number[] {
  if (values.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (range < 1e-9) return values.map(() => 0.5);
  return values.map((v) => (v - min) / range);
}
