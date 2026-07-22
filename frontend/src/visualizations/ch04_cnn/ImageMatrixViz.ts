/** ImageMatrixViz - shows a small image as a pixel matrix.

A picture is just a grid of numbers. This viz renders a 6x6 pixel grid
where each cell's brightness encodes its numeric value (0 = black, 255 = white).
Users can switch between a hand-drawn digit, a circle, and a cross.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Grid } from "@/canvas/shapes/Grid";
import { COLORS } from "@/utils/color";

/** Predefined images as 2D arrays of values in [0, 255]. */
const PREDEFINED_IMAGES: Record<string, number[][]> = {
  // A simple "7"-like digit shape (bright strokes on dark background).
  digit: [
    [255, 255, 255, 255, 0, 0],
    [0, 0, 0, 200, 0, 0],
    [0, 0, 0, 120, 0, 0],
    [0, 0, 0, 80, 0, 0],
    [0, 0, 0, 50, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  // A hollow circle / disc pattern.
  circle: [
    [0, 0, 200, 255, 0, 0],
    [0, 200, 255, 255, 200, 0],
    [200, 255, 120, 120, 255, 200],
    [200, 255, 120, 120, 255, 200],
    [0, 200, 255, 255, 200, 0],
    [0, 0, 200, 255, 0, 0],
  ],
  // A plus / cross pattern.
  cross: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 255, 255, 0, 0],
    [255, 255, 255, 255, 255, 255],
    [255, 255, 255, 255, 255, 255],
    [0, 0, 255, 255, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
};

const IMAGE_KEYS = ["digit", "circle", "cross"];

/** Match the Grid shape's internal blue->red heatmap coloring. */
function valueToHeatmapColor(val: number, vmin: number, vmax: number): string {
  const range = vmax - vmin || 1;
  const t = Math.max(0, Math.min(1, (val - vmin) / range));
  const hue = (1 - t) * 240;
  return `hsl(${hue}, 70%, 50%)`;
}

export class ImageMatrixViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "image") {
      this.render();
    }
  }

  private getImage(): number[][] {
    const idx = Math.floor(this.controls["image"] ?? 0);
    const name = IMAGE_KEYS[idx] ?? "digit";
    return PREDEFINED_IMAGES[name].map((row) => [...row]);
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;

    // Title
    const title = new Text("一张图片就是一个数字矩阵", w / 2, 36, 22);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    const image = this.getImage();
    const rows = image.length;
    const cols = image[0].length;

    // Cell size adapts to available vertical space.
    const cellSize = Math.min(56, (h - 160) / rows);
    const grid = new Grid(w / 2, h / 2 + 10, image, cellSize);
    grid.showValues = true;
    grid.fontSize = Math.max(10, Math.floor(cellSize / 3));
    grid.cellGap = 2;
    // Fix the value range to [0, 255] so the heatmap stays consistent across images
    // (0 = blue/black, 255 = red/white).
    grid.valueMin = 0;
    grid.valueMax = 255;
    this.scene.add(grid);

    // Axis labels
    const colLabel = new Text("列 (columns) ->", w / 2, h / 2 + 10 - (rows * cellSize) / 2 - 22, 13);
    colLabel.fillStyle = COLORS.textDim;
    this.scene.add(colLabel);

    const rowLabel = new Text("行\n(rows)", w / 2 - (cols * cellSize) / 2 - 36, h / 2 + 10, 13);
    rowLabel.fillStyle = COLORS.textDim;
    rowLabel.align = "center";
    this.scene.add(rowLabel);

    // Dimension annotation
    const dimText = new Text(`维度: ${rows} × ${cols} = ${rows * cols} 个像素`, w / 2, h - 50, 14);
    dimText.fillStyle = COLORS.text;
    dimText.fontFamily = "monospace";
    this.scene.add(dimText);

    // Color legend (drawn manually to match the Grid's heatmap coloring).
    this.drawLegend(w - 70, h / 2 + 10);

    this.renderer.renderOnce();
  }

  private drawLegend(cx: number, cy: number): void {
    const legendW = 20;
    const legendH = 140;
    const steps = 24;
    const topY = cy - legendH / 2;
    const segH = legendH / steps;

    for (let i = 0; i < steps; i++) {
      const t = 1 - i / steps; // top = high value (255), bottom = low (0)
      const seg = new Rect(cx, topY + segH / 2 + i * segH, legendW, segH + 0.6);
      seg.fillStyle = valueToHeatmapColor(t * 255, 0, 255);
      seg.strokeStyle = "transparent";
      this.scene.add(seg);
    }

    // Legend border
    const border = new Rect(cx, cy, legendW, legendH);
    border.fillStyle = "transparent";
    border.strokeStyle = COLORS.textDim;
    border.lineWidth = 1;
    this.scene.add(border);

    // Legend labels
    const maxLabel = new Text("255", cx + legendW / 2 + 6, topY, 11);
    maxLabel.fillStyle = COLORS.text;
    maxLabel.align = "left";
    this.scene.add(maxLabel);

    const minLabel = new Text("0", cx + legendW / 2 + 6, topY + legendH, 11);
    minLabel.fillStyle = COLORS.text;
    minLabel.align = "left";
    this.scene.add(minLabel);

    const titleLabel = new Text("像素值", cx, topY - 14, 11);
    titleLabel.fillStyle = COLORS.textDim;
    this.scene.add(titleLabel);
  }
}
