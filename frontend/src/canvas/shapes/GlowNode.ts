/** GlowNode - a glowing circle node with configurable intensity.

Renders a radial-gradient halo whose brightness scales with `intensity`
(0 = dark/inactive, 1 = fully lit).  Optionally shows a value label
inside the node.
*/

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class GlowNode extends Shape {
  radius: number;
  /** 0 = dark, 1 = fully bright */
  intensity = 0;
  /** Color hue (0-360) for the glow, default cyan */
  hue = 180;
  /** Inner label text (optional) */
  label = "";
  labelSize = 11;
  /** Multiplier for halo size */
  glowScale = 2.5;

  constructor(x = 0, y = 0, radius = 16) {
    super();
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  draw(ctx: RenderContext): void {
    const r = this.radius;
    const glowR = r * this.glowScale;
    const intensity = this.intensity;

    // Outer glow halo (radial gradient faked with linear)
    if (intensity > 0.01) {
      const grad = ctx.createLinearGradient(0, -glowR, 0, glowR);
      const alpha = intensity * 0.5;
      grad.addColorStop(0, `hsla(${this.hue}, 80%, 60%, 0)`);
      grad.addColorStop(0.3, `hsla(${this.hue}, 80%, 60%, ${alpha * 0.3})`);
      grad.addColorStop(0.5, `hsla(${this.hue}, 90%, 65%, ${alpha})`);
      grad.addColorStop(0.7, `hsla(${this.hue}, 80%, 60%, ${alpha * 0.3})`);
      grad.addColorStop(1, `hsla(${this.hue}, 80%, 60%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Node body - brightness scales with intensity
    const bodyLight = 15 + intensity * 45;
    const bodyAlpha = 0.3 + intensity * 0.7;
    ctx.fillStyle = `hsla(${this.hue}, 70%, ${bodyLight}%, ${bodyAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Ring border
    const ringAlpha = 0.4 + intensity * 0.6;
    ctx.strokeStyle = `hsla(${this.hue}, 90%, ${30 + intensity * 50}%, ${ringAlpha})`;
    ctx.lineWidth = 1.5 + intensity * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    if (this.label) {
      ctx.fillStyle = intensity > 0.3 ? "#ffffff" : "rgba(255,255,255,0.4)";
      ctx.font = `bold ${this.labelSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, 0, 0);
    }
  }
}
