/** PoolingViz - animates max/avg pooling over a feature map.

Shows the input feature map (6x6), the pooling window sliding step-by-step,
and the downsampled output. The currently selected value is highlighted so users
can see exactly which input element is chosen (max) or averaged.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Grid } from "@/canvas/shapes/Grid";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { COLORS } from "@/utils/color";
import { cnnPool } from "@/api/compute";
import type { PoolingResponse, PoolStep } from "@/types/api";

/** A 6x6 synthetic feature map with enough variation for pooling to be interesting. */
const SOURCE_FEATURE_MAP: number[][] = [
  [1, 3, 2, 4, 1, 0],
  [5, 6, 1, 2, 3, 1],
  [0, 1, 8, 7, 2, 4],
  [3, 2, 5, 9, 6, 1],
  [1, 4, 2, 3, 0, 2],
  [2, 1, 3, 1, 4, 5],
];

const STEP_DELAY_MS = 420;

export class PoolingViz extends BaseVisualization {
  private apiResponse: PoolingResponse | null = null;
  private animStep = -1;
  private animGeneration = 0;
  private revealedSteps = 0;

  onMount(): void {
    this.setVisualizationStatus("idle");
    void this.fetchAndRender();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "pool_size" || key === "mode") {
      this.animStep = -1;
      this.animGeneration++;
      this.renderer.clearAnimations();
      this.setVisualizationStatus("idle");
      void this.fetchAndRender();
    } else if (key === "run") {
      void this.runAnimation();
    }
  }

  private get poolSize(): number {
    return Math.max(2, Math.min(4, Math.floor(this.controls["pool_size"] ?? 2)));
  }

  private get mode(): "max" | "avg" {
    return this.controls["mode"] === 1 ? "avg" : "max";
  }

  private async fetchAndRender(): Promise<void> {
    this.renderLoading();
    try {
      const resp = await cnnPool({
        feature_map: SOURCE_FEATURE_MAP,
        pool_size: this.poolSize,
        stride: this.poolSize,
        mode: this.mode,
      });
      this.apiResponse = resp;
      this.animStep = -1;
      this.revealedSteps = 0;
      this.setVisualizationStatus("idle");
      this.render();
    } catch (err) {
      this.setVisualizationStatus("error");
      this.renderError(err);
    }
  }

  private async runAnimation(): Promise<void> {
    if (!this.apiResponse || this.animStep >= 0) return;
    const steps = this.apiResponse.steps;
    if (steps.length === 0) return;

    const gen = ++this.animGeneration;
    this.setVisualizationStatus("running");
    this.animStep = 0;
    this.revealedSteps = 1;
    this.render();

    for (let i = 1; i < steps.length; i++) {
      await this.delay(STEP_DELAY_MS);
      if (gen !== this.animGeneration) return;
      this.animStep = i;
      this.revealedSteps = i + 1;
      this.render();
    }

    await this.delay(STEP_DELAY_MS * 3);
    if (gen !== this.animGeneration) return;
    this.animStep = -1;
    this.revealedSteps = steps.length;
    this.render();
    this.setVisualizationStatus("completed");
  }

  private delay(ms: number): Promise<void> {
    return this.waitForAnimation(ms);
  }

  private renderLoading(): void {
    this.scene.clear();
    const t = new Text("正在计算池化...", this.width / 2, this.height / 2, 16);
    t.fillStyle = COLORS.textDim;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private renderError(err: unknown): void {
    this.scene.clear();
    const msg = err instanceof Error ? err.message : String(err);
    const t = new Text(`API 错误: ${msg}`, this.width / 2, this.height / 2, 14);
    t.fillStyle = COLORS.negative;
    this.scene.add(t);
    this.renderer.renderOnce();
  }

  private render(): void {
    this.scene.clear();
    if (!this.apiResponse) {
      this.renderLoading();
      return;
    }

    const w = this.width;
    const h = this.height;

    // Title
    const modeLabel = this.mode === "max" ? "最大池化 (Max Pooling)" : "平均池化 (Avg Pooling)";
    const title = new Text(`池化运算: ${modeLabel}`, w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    const rows = SOURCE_FEATURE_MAP.length;
    const cols = SOURCE_FEATURE_MAP[0].length;
    const cellSize = Math.min(40, (h - 160) / rows, (w * 0.4) / cols);

    const inCx = w * 0.25;
    const inCy = h / 2 + 20;
    const outCx = w * 0.72;
    const outCy = h / 2 + 20;

    // --- Input feature map ---
    const inGrid = new Grid(inCx, inCy, SOURCE_FEATURE_MAP, cellSize);
    inGrid.showValues = true;
    inGrid.fontSize = Math.max(9, Math.floor(cellSize / 3));
    inGrid.cellGap = 2;
    inGrid.valueMin = 0;
    inGrid.valueMax = 9;
    this.scene.add(inGrid);

    const inLabel = new Text("输入特征图", inCx, inCy + (rows * cellSize) / 2 + 22, 13);
    inLabel.fillStyle = COLORS.text;
    this.scene.add(inLabel);

    // --- Highlight current pooling window ---
    const activeStep: PoolStep | null =
      this.animStep >= 0 ? this.apiResponse.steps[this.animStep] : null;

    if (activeStep) {
      const inLeft = inCx - (cols * cellSize) / 2;
      const inTop = inCy - (rows * cellSize) / 2;
      const hlX = inLeft + activeStep.col * this.poolSize * cellSize;
      const hlY = inTop + activeStep.row * this.poolSize * cellSize;
      const hlSize = this.poolSize * cellSize;
      const hl = new Rect(hlX + hlSize / 2, hlY + hlSize / 2, hlSize, hlSize);
      hl.fillStyle = "rgba(251, 191, 36, 0.18)";
      hl.strokeStyle = COLORS.highlight;
      hl.lineWidth = 3;
      this.scene.add(hl);

      // Highlight the selected value within the region for max pooling.
      if (this.mode === "max") {
        const region = activeStep.region;
        let maxR = 0;
        let maxC = 0;
        let maxV = -Infinity;
        for (let r = 0; r < region.length; r++) {
          for (let c = 0; c < region[r].length; c++) {
            if (region[r][c] > maxV) {
              maxV = region[r][c];
              maxR = r;
              maxC = c;
            }
          }
        }
        const selX = hlX + maxC * cellSize + cellSize / 2;
        const selY = hlY + maxR * cellSize + cellSize / 2;
        const sel = new Rect(selX, selY, cellSize, cellSize);
        sel.fillStyle = "transparent";
        sel.strokeStyle = COLORS.positive;
        sel.lineWidth = 2.5;
        this.scene.add(sel);
      }
    }

    // Arrow from input to output
    const arrow = new Arrow(
      inCx + (cols * cellSize) / 2 + 8,
      inCy,
      outCx - (this.apiResponse.output[0]?.length ?? 1) * cellSize / 2 - 8,
      outCy,
      8,
    );
    arrow.strokeStyle = COLORS.accent2;
    arrow.lineWidth = 2;
    this.scene.add(arrow);

    const poolDesc = new Text(`pool_size=${this.poolSize}`, (inCx + outCx) / 2, inCy - 24, 12);
    poolDesc.fillStyle = COLORS.accent3;
    poolDesc.fontFamily = "monospace";
    this.scene.add(poolDesc);

    // --- Output feature map ---
    const output = this.apiResponse.output;
    const outGrid = new Grid(outCx, outCy, output, cellSize);
    outGrid.showValues = true;
    outGrid.fontSize = Math.max(9, Math.floor(cellSize / 3));
    outGrid.cellGap = 2;
    outGrid.valueMin = 0;
    outGrid.valueMax = 9;
    this.scene.add(outGrid);

    // Cover cells that have not been visited yet so the output is revealed step-by-step.
    const outLeft = outCx - (output[0].length * cellSize) / 2;
    const outTop = outCy - (output.length * cellSize) / 2;
    for (let r = 0; r < output.length; r++) {
      for (let c = 0; c < output[r].length; c++) {
        const index = r * output[r].length + c;
        if (index < this.revealedSteps) continue;
        const cx = outLeft + c * cellSize + cellSize / 2;
        const cy = outTop + r * cellSize + cellSize / 2;
        const cover = new Rect(cx, cy, cellSize - 4, cellSize - 4, 3);
        cover.fillStyle = "rgba(15, 23, 42, 0.96)";
        cover.strokeStyle = "rgba(148, 163, 184, 0.32)";
        cover.lineWidth = 1;
        this.scene.add(cover);
        const marker = new Text("·", cx, cy, Math.max(12, Math.floor(cellSize / 2)));
        marker.fillStyle = COLORS.textDim;
        this.scene.add(marker);
      }
    }

    const outLabel = new Text("输出特征图 (下采样)", outCx, outCy + (output.length * cellSize) / 2 + 22, 13);
    outLabel.fillStyle = COLORS.text;
    this.scene.add(outLabel);

    // --- Highlight output cell + computation read-out ---
    if (activeStep) {
      const cellX = outLeft + activeStep.col * cellSize;
      const cellY = outTop + activeStep.row * cellSize;
      const cellHL = new Rect(cellX + cellSize / 2, cellY + cellSize / 2, cellSize, cellSize);
      cellHL.fillStyle = "transparent";
      cellHL.strokeStyle = COLORS.positive;
      cellHL.lineWidth = 3;
      this.scene.add(cellHL);

      const region = activeStep.region;
      const flat = region.flat();
      const compText = new Text(
        `[${activeStep.row},${activeStep.col}] ← {${
          this.mode === "max" ? "max" : "avg"
        }(${flat.join(", ")})} = ${activeStep.result.toFixed(this.mode === "avg" ? 2 : 0)}`,
        w / 2,
        h - 42,
        12,
      );
      compText.fillStyle = COLORS.highlight;
      compText.fontFamily = "monospace";
      this.scene.add(compText);
    } else {
      const status = new Text(
        `窗口 ${this.poolSize}×${this.poolSize}  •  按 "run" 开始滑动`,
        w / 2,
        h - 42,
        13,
      );
      status.fillStyle = COLORS.textDim;
      this.scene.add(status);
    }

    this.renderer.renderOnce();
  }
}
