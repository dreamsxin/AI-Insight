/** ConvolutionViz - animates a convolution kernel sliding over an image.

Shows the input image, a 3x3 edge-detection kernel, and the output feature map.
Pressing "run" animates the kernel sliding step-by-step. The kernel is drawn as a
GLOWING RECTANGLE (flashlight) that slides smoothly across the image, the 3x3
receptive field under it is highlighted, and when the kernel lands a PARTICLE
travels from the kernel to the corresponding output cell (showing "computation
happening"). Output cells POP IN (scale 0->1 with easeOutBack) and a GlowPulse
ring expands at the cell as it is computed.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Grid } from "@/canvas/shapes/Grid";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Particle } from "@/canvas/shapes/Particle";
import { GlowPulse } from "@/canvas/shapes/GlowPulse";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";
import { cnnConvolve } from "@/api/compute";
import type { ConvolveResponse, ConvolveStep } from "@/types/api";

/** 3x3 edge-detection kernel (matches backend PREDEFINED_KERNELS["edge"]). */
const EDGE_KERNEL: number[][] = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];

/** Fixed 6x6 image with strong edges so the edge kernel produces a clear result. */
const CONV_IMAGE: number[][] = [
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
  [10, 10, 10, 200, 200, 200],
];

const SLIDE_MS = 280;
const PARTICLE_MS = 300;
const POP_MS = 360;
const HOLD_FINAL_MS = 1400;

/** Flashlight hue (warm amber) for the sliding kernel. */
const KERNEL_HUE = 45;

export class ConvolutionViz extends BaseVisualization {
  private apiResponse: ConvolveResponse | null = null;
  private animStep = -1; // -1 = idle, >=0 = step index being animated
  private animGeneration = 0; // bumped to cancel stale animations
  private loading = false;

  /** Current center of the sliding kernel (in image pixel coords). */
  private kernelCenter = { x: 0, y: 0 };
  /** Whether the flashlight is currently visible. */
  private kernelVisible = false;
  /** Particle traveling kernel -> output cell. */
  private particleState = { progress: 0, active: false, x1: 0, y1: 0, x2: 0, y2: 0 };
  /** Expanding ring at the just-computed output cell. */
  private pulseState = { progress: 0, active: false, x: 0, y: 0 };
  /** Per-output-cell pop-in scale (0 -> 1). */
  private cellScales = new Map<string, number>();

  onMount(): void {
    this.setVisualizationStatus("idle");
    void this.fetchAndRender();
  }

  onControlChange(key: string, value: number): void {
    if (key === "stride") {
      // Stride change requires re-fetching from the API.
      this.animStep = -1;
      this.cancelAnimation();
      this.setVisualizationStatus("idle");
      void this.fetchAndRender();
    } else if (key === "run") {
      // "run" button press: kick off the step-by-step animation.
      if (!this.loading) void this.runAnimation();
    }
  }

  private get stride(): number {
    const s = Math.floor(this.controls["stride"] ?? 1);
    return Math.max(1, Math.min(3, s));
  }

  private async fetchAndRender(): Promise<void> {
    this.loading = true;
    this.renderLoading();
    try {
      const resp = await cnnConvolve({
        image: CONV_IMAGE,
        kernel: EDGE_KERNEL,
        stride: this.stride,
        padding: 0,
      });
      this.apiResponse = resp;
      this.animStep = -1;
      this.kernelVisible = false;
      this.particleState.active = false;
      this.pulseState.active = false;
      this.cellScales.clear();
      this.loading = false;
      this.setVisualizationStatus("idle");
      this.render();
    } catch (err) {
      this.loading = false;
      this.setVisualizationStatus("error");
      this.renderError(err);
    }
  }

  private cancelAnimation(): void {
    this.animGeneration++;
    this.renderer.clearAnimations();
  }

  /** Run a tween to completion, re-rendering each frame. */
  private tweenState(
    state: Record<string, number>,
    end: Record<string, number>,
    duration: number,
    easing: (t: number) => number = Easing.easeInOutCubic,
    onUpdateExtra?: () => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      const tw = new Tween(state, end, duration, easing);
      tw.onUpdate(() => {
        if (onUpdateExtra) onUpdateExtra();
        this.render();
      });
      tw.onComplete(() => {
        this.render();
        resolve();
      });
      this.renderer.addTween(tw);
    });
  }

  /** Pixel-space center of the 3x3 receptive field for a given step. */
  private stepImageCenter(step: ConvolveStep, imgLeft: number, imgTop: number, cellSize: number): { x: number; y: number } {
    const tlx = imgLeft + step.col * this.stride * cellSize;
    const tly = imgTop + step.row * this.stride * cellSize;
    return { x: tlx + (3 * cellSize) / 2, y: tly + (3 * cellSize) / 2 };
  }

  /** Pixel-space center of an output cell. */
  private outputCellCenter(step: ConvolveStep, outLeft: number, outTop: number, cellSize: number): { x: number; y: number } {
    return {
      x: outLeft + step.col * cellSize + cellSize / 2,
      y: outTop + step.row * cellSize + cellSize / 2,
    };
  }

  private async runAnimation(): Promise<void> {
    if (!this.apiResponse || this.animStep >= 0) return;
    const steps = this.apiResponse.steps;
    if (steps.length === 0) return;

    const gen = ++this.animGeneration;
    this.setVisualizationStatus("running");
    this.renderer.clearAnimations();
    this.cellScales.clear();
    this.particleState.active = false;
    this.pulseState.active = false;

    // Layout-dependent pixel coords (recompute to be safe against resize).
    const layout = this.layout();

    // Start the flashlight at the first step's position.
    const first = steps[0];
    const firstPos = this.stepImageCenter(first, layout.imgLeft, layout.imgTop, layout.cellSize);
    this.kernelCenter.x = firstPos.x;
    this.kernelCenter.y = firstPos.y;
    this.kernelVisible = true;
    this.animStep = 0;
    this.render();
    await this.popCell(first, layout);
    await this.fireParticle(first, layout);
    if (gen !== this.animGeneration) return;

    for (let i = 1; i < steps.length; i++) {
      const step = steps[i];
      const target = this.stepImageCenter(step, layout.imgLeft, layout.imgTop, layout.cellSize);
      // Slide the flashlight to the new receptive field.
      await this.tweenState(
        this.kernelCenter,
        { x: target.x, y: target.y },
        SLIDE_MS,
        Easing.easeInOutCubic,
      );
      if (gen !== this.animGeneration) return;
      this.animStep = i;
      this.render();
      await this.popCell(step, layout);
      await this.fireParticle(step, layout);
      if (gen !== this.animGeneration) return;
    }

    // Hold the final frame, then reset to idle.
    await this.delay(HOLD_FINAL_MS);
    if (gen !== this.animGeneration) return;
    this.animStep = -1;
    this.kernelVisible = false;
    this.particleState.active = false;
    this.pulseState.active = false;
    this.render();
    this.setVisualizationStatus("completed");
  }

  /** Pop an output cell in (scale 0 -> 1 with easeOutBack) and emit a ring. */
  private async popCell(step: ConvolveStep, layout: Layout): Promise<void> {
    const key = `${step.row},${step.col}`;
    if (this.cellScales.has(key) && (this.cellScales.get(key) ?? 0) >= 1) return;
    this.cellScales.set(key, 0);

    // Expanding ring at the output cell.
    const oc = this.outputCellCenter(step, layout.outLeft, layout.outTop, layout.cellSize);
    this.pulseState = { progress: 0, active: true, x: oc.x, y: oc.y };
    const pulse = { p: 0 };
    const pop = { v: 0 };
    // Run pop-in and the ring together.
    await Promise.all([
      this.tweenState(pop, { v: 1 }, POP_MS, Easing.easeOutBack, () => {
        this.cellScales.set(key, pop.v);
      }),
      this.tweenState(pulse, { p: 1 }, POP_MS, Easing.easeOutCubic, () => {
        this.pulseState.progress = pulse.p;
      }).then(() => {
        this.pulseState.active = false;
      }),
    ]);
  }

  /** Send a particle from the kernel to the output cell. */
  private async fireParticle(step: ConvolveStep, layout: Layout): Promise<void> {
    const from = this.stepImageCenter(step, layout.imgLeft, layout.imgTop, layout.cellSize);
    const to = this.outputCellCenter(step, layout.outLeft, layout.outTop, layout.cellSize);
    this.particleState = {
      progress: 0,
      active: true,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    };
    const s = { p: 0 };
    await this.tweenState(s, { p: 1 }, PARTICLE_MS, Easing.easeInOutCubic, () => {
      this.particleState.progress = s.p;
    });
    this.particleState.active = false;
    this.render();
  }

  private delay(ms: number): Promise<void> {
    return this.waitForAnimation(ms);
  }

  private renderLoading(): void {
    this.scene.clear();
    const t = new Text("正在计算卷积...", this.width / 2, this.height / 2, 16);
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

  /** Compute the pixel layout used by both animation and rendering. */
  private layout(): Layout {
    const w = this.width;
    const h = this.height;
    const rows = CONV_IMAGE.length;
    const cols = CONV_IMAGE[0].length;
    const cellSize = Math.min(42, (h - 180) / rows, (w * 0.34) / cols);
    const imgCx = w * 0.22;
    const imgCy = h / 2 + 24;
    const kernelCx = w * 0.5;
    const kernelCy = h / 2 + 24;
    const outCx = w * 0.8;
    const outCy = h / 2 + 24;
    const imgLeft = imgCx - (cols * cellSize) / 2;
    const imgTop = imgCy - (rows * cellSize) / 2;
    const outCols = this.apiResponse ? this.apiResponse.output[0]?.length ?? 1 : 1;
    const outRows = this.apiResponse ? this.apiResponse.output.length : 1;
    const outLeft = outCx - (outCols * cellSize) / 2;
    const outTop = outCy - (outRows * cellSize) / 2;
    return {
      w, h, rows, cols, cellSize,
      imgCx, imgCy, imgLeft, imgTop,
      kernelCx, kernelCy, outCx, outCy, outLeft, outTop, outCols, outRows,
    };
  }

  private render(): void {
    this.scene.clear();
    if (!this.apiResponse) {
      this.renderLoading();
      return;
    }

    const L = this.layout();
    const { w, h, cellSize } = L;
    const output = this.apiResponse.output;

    // Title
    const title = new Text("卷积运算: 核在图像上滑动", w / 2, 28, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Plain-language metaphor label ---
    const metaphor = new Text("🔦 手电筒扫过图片，每照一块就得到一个特征值", w / 2, 54, 14);
    metaphor.fillStyle = COLORS.highlight;
    this.scene.add(metaphor);

    // --- Input image ---
    const imgGrid = new Grid(L.imgCx, L.imgCy, CONV_IMAGE, cellSize);
    imgGrid.showValues = true;
    imgGrid.fontSize = Math.max(9, Math.floor(cellSize / 3.2));
    imgGrid.cellGap = 2;
    imgGrid.valueMin = 0;
    imgGrid.valueMax = 255;
    this.scene.add(imgGrid);

    const imgLabel = new Text("输入图像", L.imgCx, L.imgCy + (L.rows * cellSize) / 2 + 22, 13);
    imgLabel.fillStyle = COLORS.text;
    this.scene.add(imgLabel);

    // --- Kernel legend (3x3) in the middle ---
    const kCell = cellSize * 0.8;
    const kernelGrid = new Grid(L.kernelCx, L.kernelCy - 36, EDGE_KERNEL, kCell);
    kernelGrid.showValues = true;
    kernelGrid.fontSize = Math.max(9, Math.floor(kCell / 3));
    kernelGrid.cellGap = 2;
    kernelGrid.valueMin = -1;
    kernelGrid.valueMax = 8;
    this.scene.add(kernelGrid);

    const kernelLabel = new Text("卷积核 (3x3)", L.kernelCx, L.kernelCy - 36 + (3 * kCell) / 2 + 22, 13);
    kernelLabel.fillStyle = COLORS.accent3;
    this.scene.add(kernelLabel);

    const formula = new Text("output[i,j] = Σ kernel[m,n] × image[i+m, j+n]", L.kernelCx, L.kernelCy + 52, 12);
    formula.fillStyle = COLORS.textDim;
    formula.fontFamily = "monospace";
    this.scene.add(formula);

    // Arrows
    const arrow1 = new Arrow(
      L.imgCx + (L.cols * cellSize) / 2 + 6,
      L.imgCy,
      L.kernelCx - (3 * kCell) / 2 - 6,
      L.kernelCy - 36,
      8,
    );
    arrow1.strokeStyle = COLORS.accent2;
    arrow1.lineWidth = 2;
    this.scene.add(arrow1);

    const arrow2 = new Arrow(
      L.kernelCx + (3 * kCell) / 2 + 6,
      L.kernelCy - 36,
      L.outCx - (output[0]?.length ?? 1) * cellSize / 2 - 6,
      L.outCy,
      8,
    );
    arrow2.strokeStyle = COLORS.accent2;
    arrow2.lineWidth = 2;
    this.scene.add(arrow2);

    // --- Output feature map (drawn cell-by-cell for pop-in scale) ---
    const outLabel = new Text("特征图 (输出)", L.outCx, L.outCy + (output.length * cellSize) / 2 + 22, 13);
    outLabel.fillStyle = COLORS.text;
    this.scene.add(outLabel);

    const oRows = output.length;
    const oCols = output[0]?.length ?? 1;
    const vmin = this.valueMin(output);
    const vmax = this.valueMax(output);
    const range = vmax - vmin || 1;
    for (let r = 0; r < oRows; r++) {
      for (let c = 0; c < oCols; c++) {
        const val = output[r][c];
        const t = (val - vmin) / range;
        const hue = (1 - t) * 240;
        const cx = L.outLeft + c * cellSize + cellSize / 2;
        const cy = L.outTop + r * cellSize + cellSize / 2;
        const scale = this.cellScales.get(`${r},${c}`) ?? 0;
        if (scale <= 0.001) continue;

        const cell = new Rect(cx, cy, cellSize - 4, cellSize - 4, 3);
        cell.scale = scale;
        cell.fillStyle = `hsl(${hue}, 70%, 50%)`;
        cell.strokeStyle = "transparent";
        this.scene.add(cell);

        if (cellSize >= 20) {
          const v = new Text(val.toFixed(1), cx, cy, Math.max(9, Math.floor(cellSize / 3.2)));
          v.scale = scale;
          v.fillStyle = t > 0.5 ? "#1a1a2e" : "#e2e8f0";
          v.fontFamily = "monospace";
          this.scene.add(v);
        }
      }
    }

    // --- Flashlight (glowing kernel rectangle) sliding over the image ---
    const activeStep: ConvolveStep | null =
      this.animStep >= 0 ? this.apiResponse.steps[this.animStep] : null;

    if (this.kernelVisible || activeStep) {
      const kx = this.kernelVisible ? this.kernelCenter.x : 0;
      const ky = this.kernelVisible ? this.kernelCenter.y : 0;
      const size = 3 * cellSize;
      this.drawGlowRect(kx, ky, size, size, KERNEL_HUE, 1);

      // Highlight the 3x3 receptive field border.
      const rf = new Rect(kx, ky, size, size, 4);
      rf.fillStyle = "transparent";
      rf.strokeStyle = `hsla(${KERNEL_HUE}, 100%, 75%, 0.95)`;
      rf.lineWidth = 3;
      this.scene.add(rf);
    }

    // --- Particle: kernel -> output cell ---
    if (this.particleState.active) {
      const p = this.particleState;
      const particle = new Particle(p.x1, p.y1, p.x2, p.y2, 4, KERNEL_HUE);
      particle.progress = p.progress;
      particle.trailLength = 8;
      this.scene.add(particle);
    }

    // --- GlowPulse ring at the just-computed output cell ---
    if (this.pulseState.active) {
      const pulse = new GlowPulse(this.pulseState.x, this.pulseState.y, cellSize * 1.6, KERNEL_HUE);
      pulse.progress = this.pulseState.progress;
      pulse.lineWidth = 2.5;
      this.scene.add(pulse);
    }

    // --- Computation read-out / status ---
    if (activeStep) {
      const rf = activeStep.receptive_field;
      const terms = rf.map((row, m) =>
        row.map((v, n) => `${EDGE_KERNEL[m][n]}×${v.toFixed(0)}`).join(" + "),
      );
      const compText = new Text(
        `[${activeStep.row},${activeStep.col}] = ${terms.join(" + ")} = ${activeStep.result.toFixed(1)}`,
        w / 2,
        h - 40,
        12,
      );
      compText.fillStyle = COLORS.highlight;
      compText.fontFamily = "monospace";
      this.scene.add(compText);
    } else {
      const status = new Text(
        `步幅 stride = ${this.stride}  •  按 "run" 开始手电筒滑动动画`,
        w / 2,
        h - 40,
        13,
      );
      status.fillStyle = COLORS.textDim;
      this.scene.add(status);
    }

    this.renderer.renderOnce();
  }

  /** Draw a glowing rectangle (flashlight) by layering translucent rects. */
  private drawGlowRect(cx: number, cy: number, w: number, h: number, hue: number, intensity: number): void {
    const layers = [
      { mul: 1.55, alpha: 0.08 },
      { mul: 1.32, alpha: 0.13 },
      { mul: 1.14, alpha: 0.2 },
    ];
    for (const ly of layers) {
      const g = new Rect(cx, cy, w * ly.mul, h * ly.mul, 8);
      g.fillStyle = `hsla(${hue}, 95%, 62%, ${ly.alpha * intensity})`;
      g.strokeStyle = "transparent";
      this.scene.add(g);
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

interface Layout {
  w: number;
  h: number;
  rows: number;
  cols: number;
  cellSize: number;
  imgCx: number;
  imgCy: number;
  imgLeft: number;
  imgTop: number;
  kernelCx: number;
  kernelCy: number;
  outCx: number;
  outCy: number;
  outLeft: number;
  outTop: number;
  outCols: number;
  outRows: number;
}
