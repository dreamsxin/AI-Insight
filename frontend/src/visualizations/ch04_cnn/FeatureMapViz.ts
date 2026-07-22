/** FeatureMapViz - applies 4 kernels to the same image and shows feature maps side by side.

The 4 kernels (edge, blur, sharpen, emboss) come from the backend's PREDEFINED_KERNELS.
Each kernel is convolved with the same input image; the four resulting feature maps
are displayed in a 2x2 grid, with the selected kernel's result highlighted.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Grid } from "@/canvas/shapes/Grid";
import { Rect } from "@/canvas/shapes/Rect";
import { COLORS } from "@/utils/color";
import { cnnConvolve } from "@/api/compute";
import type { ConvolveResponse } from "@/types/api";

/** Kernel definitions mirroring backend cnn.py PREDEFINED_KERNELS. */
const KERNELS: Record<string, number[][]> = {
  edge: [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1],
  ],
  blur: [
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
    [1 / 9, 1 / 9, 1 / 9],
  ],
  sharpen: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
  emboss: [
    [-2, -1, 0],
    [-1, 1, 1],
    [0, 1, 2],
  ],
};

const KERNEL_KEYS = ["edge", "blur", "sharpen", "emboss"];

const KERNEL_LABELS: Record<string, string> = {
  edge: "边缘检测 edge",
  blur: "模糊 blur",
  sharpen: "锐化 sharpen",
  emboss: "浮雕 emboss",
};

/** Fixed 6x6 image with edges so all kernels produce interpretable results. */
const SOURCE_IMAGE: number[][] = [
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
];

interface KernelResult {
  name: string;
  kernel: number[][];
  response: ConvolveResponse | null;
  error: string | null;
}

export class FeatureMapViz extends BaseVisualization {
  private results: KernelResult[] = [];
  private loading = false;

  onMount(): void {
    void this.fetchAllAndRender();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "kernel") {
      // Just re-render to move the highlight; data is already loaded.
      this.render();
    }
  }

  private getSelectedIndex(): number {
    return Math.max(0, Math.min(3, Math.floor(this.controls["kernel"] ?? 0)));
  }

  private async fetchAllAndRender(): Promise<void> {
    this.loading = true;
    this.renderLoading();

    // Initialise result slots.
    this.results = KERNEL_KEYS.map((name) => ({
      name,
      kernel: KERNELS[name],
      response: null,
      error: null,
    }));

    // Fetch all four convolutions in parallel.
    const settled = await Promise.allSettled(
      this.results.map((r) =>
        cnnConvolve({ image: SOURCE_IMAGE, kernel: r.kernel, stride: 1, padding: 0 }),
      ),
    );

    this.results = this.results.map((r, i) => {
      const s = settled[i];
      if (s.status === "fulfilled") {
        return { ...r, response: s.value };
      }
      return { ...r, error: s.reason instanceof Error ? s.reason.message : String(s.reason) };
    });

    this.loading = false;
    this.render();
  }

  private renderLoading(): void {
    this.scene.clear();
    const t = new Text("正在计算 4 种卷积核...", this.width / 2, this.height / 2, 16);
    t.fillStyle = COLORS.textDim;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;

    // Title
    const title = new Text("同一个图像 × 不同的卷积核 = 不同的特征图", w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    if (this.results.length === 0) {
      this.renderLoading();
      return;
    }

    const selected = this.getSelectedIndex();

    // 2x2 grid of feature maps in the right ~70% of the canvas.
    const mapAreaX = w * 0.32;
    const mapAreaW = w - mapAreaX - 20;
    const cellW = mapAreaW / 2;
    const cellH = (h - 110) / 2;
    const mapCellSize = Math.min(cellW, cellH) * 0.7;

    for (let i = 0; i < this.results.length; i++) {
      const col = i % 2;
      const rowi = Math.floor(i / 2);
      const cx = mapAreaX + col * cellW + cellW / 2;
      const cy = 70 + rowi * cellH + cellH / 2;
      this.drawFeatureMap(this.results[i], i, cx, cy, mapCellSize, i === selected);
    }

    // Kernel list panel on the left.
    this.drawKernelList(20, 70, w * 0.28, h - 110, selected);

    this.renderer.renderOnce();
  }

  private drawFeatureMap(
    kr: KernelResult,
    index: number,
    cx: number,
    cy: number,
    cellSize: number,
    highlighted: boolean,
  ): void {
    // Selection highlight frame
    const frameW = 3 * cellSize + 30;
    const frameH = 3 * cellSize + 46;
    const frame = new Rect(cx, cy, frameW, frameH, 8);
    frame.fillStyle = highlighted ? "rgba(251, 191, 36, 0.08)" : "rgba(255,255,255,0.02)";
    frame.strokeStyle = highlighted ? COLORS.highlight : COLORS.edge;
    frame.lineWidth = highlighted ? 2.5 : 1;
    this.scene.add(frame);

    // Label
    const label = new Text(KERNEL_LABELS[kr.name], cx, cy - frameH / 2 + 16, 13);
    label.fillStyle = highlighted ? COLORS.highlight : COLORS.text;
    label.fontWeight = highlighted ? "bold" : "normal";
    this.scene.add(label);

    // Render the feature map grid
    if (kr.response) {
      const output = kr.response.output;
      const grid = new Grid(cx, cy + 6, output, cellSize);
      grid.showValues = true;
      grid.fontSize = Math.max(9, Math.floor(cellSize / 3.2));
      grid.cellGap = 2;
      grid.valueMin = this.valueMin(output);
      grid.valueMax = this.valueMax(output);
      this.scene.add(grid);
    } else if (kr.error) {
      const errT = new Text("错误", cx, cy + 6, 12);
      errT.fillStyle = COLORS.negative;
      this.scene.add(errT);
    }
    void index;
  }

  private drawKernelList(x: number, y: number, w: number, h: number, selected: number): void {
    const panel = new Rect(x + w / 2, y + h / 2, w, h, 8);
    panel.fillStyle = "rgba(255,255,255,0.02)";
    panel.strokeStyle = COLORS.edge;
    panel.lineWidth = 1;
    this.scene.add(panel);

    const panelTitle = new Text("卷积核", x + w / 2, y + 18, 14);
    panelTitle.fillStyle = COLORS.text;
    panelTitle.fontWeight = "bold";
    this.scene.add(panelTitle);

    const itemH = (h - 40) / 4;
    for (let i = 0; i < 4; i++) {
      const kr = this.results[i];
      const iy = y + 40 + i * itemH + itemH / 2;
      const isSel = i === selected;

      // Row background
      const rowBg = new Rect(x + w / 2, iy, w - 16, itemH - 6, 6);
      rowBg.fillStyle = isSel ? "rgba(251, 191, 36, 0.12)" : "transparent";
      rowBg.strokeStyle = isSel ? COLORS.highlight : "transparent";
      rowBg.lineWidth = 1;
      this.scene.add(rowBg);

      const name = new Text(KERNEL_LABELS[kr.name], x + 16, iy - 8, 12);
      name.fillStyle = isSel ? COLORS.highlight : COLORS.text;
      name.align = "left";
      name.fontWeight = isSel ? "bold" : "normal";
      this.scene.add(name);

      // Mini 3x3 kernel preview
      const kCell = Math.min(14, (w - 40) / 5);
      const mkGrid = new Grid(x + w - 16 - (3 * kCell) / 2, iy + 6, kr.kernel, kCell);
      mkGrid.showValues = false;
      mkGrid.cellGap = 1;
      mkGrid.valueMin = -2;
      mkGrid.valueMax = 8;
      this.scene.add(mkGrid);
    }
  }

  private valueMin(m: number[][]): number {
    let v = Infinity;
    for (const row of m) for (const x of row) if (x < v) v = x;
    return v === Infinity ? 0 : v;
  }

  private valueMax(m: number[][]): number {
    let v = -Infinity;
    for (const row of m) for (const x of row) if (x > v) v = x;
    return v === -Infinity ? 1 : v;
  }
}
