/** Grid shape - used for matrices, pixel images, feature maps. */

import type { RenderContext } from "@/types/canvas";
import { Shape } from "./Shape";

export class Grid extends Shape {
  rows: number;
  cols: number;
  cellSize: number;
  values: number[][];
  /** Optional min/max for color mapping; auto-detected if not set. */
  valueMin: number | null = null;
  valueMax: number | null = null;
  showValues: boolean = false;
  cellGap: number = 1;
  fontSize: number = 10;

  constructor(x = 0, y = 0, values: number[][] = [], cellSize = 30) {
    super();
    this.x = x;
    this.y = y;
    this.values = values;
    this.cellSize = cellSize;
    this.rows = values.length;
    this.cols = values.length > 0 ? values[0].length : 0;
  }

  draw(ctx: RenderContext): void {
    if (this.rows === 0 || this.cols === 0) return;

    const vmin = this.valueMin ?? Math.min(...this.values.flat());
    const vmax = this.valueMax ?? Math.max(...this.values.flat());
    const range = vmax - vmin || 1;

    const cs = this.cellSize;
    const offsetX = -(this.cols * cs) / 2;
    const offsetY = -(this.rows * cs) / 2;

    ctx.save();
    ctx.font = `${this.fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const val = this.values[r][c];
        const t = (val - vmin) / range;
        // Blue (low) to red (high) heatmap
        const hue = (1 - t) * 240;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(offsetX + c * cs + this.cellGap, offsetY + r * cs + this.cellGap,
          cs - 2 * this.cellGap, cs - 2 * this.cellGap);

        if (this.showValues && cs >= 20) {
          ctx.fillStyle = t > 0.5 ? "#1a1a2e" : "#e2e8f0";
          ctx.fillText(
            val.toFixed(1),
            offsetX + c * cs + cs / 2,
            offsetY + r * cs + cs / 2,
          );
        }
      }
    }
    ctx.restore();
  }
}
