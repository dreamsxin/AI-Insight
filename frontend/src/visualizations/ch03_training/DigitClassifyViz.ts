/** DigitClassifyViz - train a network to recognize 8x8 handwritten digits.

Layout:
  ┌────────────┬──────────────────┐
  │ 8x8 pixel  │  Output probs    │
  │ digit grid │  (10 bars 0-9)   │
  │            │                  │
  ├────────────┼──────────────────┤
  │ Loss curve │  Accuracy curve  │
  └────────────┴──────────────────┘

Trains step-by-step via /nn/train/step, cycling through test samples to
show predictions evolving. Supports model save/load.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { MouseHandler } from "@/canvas/interaction/MouseHandler";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { Rect } from "@/canvas/shapes/Rect";
import { Grid } from "@/canvas/shapes/Grid";
import { COLORS } from "@/utils/color";
import { sigmoid } from "@/utils/math";
import {
  nnTrainStep,
  fetchDataset,
  fetchSavedModels,
  saveModel,
  loadModel,
} from "@/api/compute";
import type { DatasetResponse, SavedModelSummary, OptimizerState } from "@/types/api";

interface Region {
  x: number; y: number; w: number; h: number;
}

const ACTIVATION = "relu";
const DIGIT_PIXEL_RES = 8;

export class DigitClassifyViz extends BaseVisualization {
  private trainGeneration = 0;
  private running = false;
  private paused = false;

  private currentWeights: number[][][] = [];
  private currentBiases: number[][] = [];
  private currentOptimizerState: OptimizerState | null = null;
  private currentEpoch = 0;
  private currentLoss = 0;
  private currentAccuracy: number | null = null;
  private lossHistory: number[] = [];
  private accHistory: number[] = [];
  private loadedModelId: string | null = null;
  private loadedModelName: string | null = null;

  private dataset: DatasetResponse | null = null;
  private savedModels: SavedModelSummary[] = [];

  // Scene objects
  private pixelGrid: Grid | null = null;
  private probBars: Rect[] = [];
  private probLabels: Text[] = [];
  private predLabel: Text | null = null;
  private trueLabel: Text | null = null;
  private epochText: Text | null = null;
  private lossText: Text | null = null;
  private accText: Text | null = null;
  private modelStatusText: Text | null = null;
  private phaseText: Text | null = null;

  // Drawing state for hand-written digit testing
  private isDrawing = false;
  private drawPixels: number[][] = []; // 8×8 hand-drawn pixel values 0..1
  private drawingMode = false; // true = hand-draw test, false = dataset sample
  private pixelGeom = { cx: 0, cy: 0, size: 0, cellSize: 0 };

  private _modelName = "我的数字模型";

  // Layout regions
  private pixelRegion!: Region;
  private probRegion!: Region;
  private lossRegion!: Region;
  private accRegion!: Region;

  onMount(): void {
    if (!this.mouseHandler) {
      this.mouseHandler = new MouseHandler(this.canvas);
    }
    this.mouseHandler.onMouseDown((x, y) => this.startDraw(x, y));
    this.mouseHandler.onMouseMove((x, y) => this.continueDraw(x, y));
    this.mouseHandler.onMouseUp(() => this.endDraw());
    this.loadDataset();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run") {
      if (this.paused) {
        this.paused = false;
        this.running = true;
        this.resume();
        return;
      }
      if (!this.running) this.runTraining();
      return;
    }
    if (key === "mode") {
      this.switchMode(Math.floor(this.controls["mode"] ?? 0) === 1);
      return;
    }
    if (key === "clear") {
      this.clearDrawing();
      return;
    }
    if (key === "test_sample") {
      if (!this.drawingMode) this.updateTestSample();
      return;
    }
    if (key === "save") {
      this.handleSaveModel();
      return;
    }
    if (key === "load") {
      this.handleLoadModel();
      return;
    }
  }

  onTextChange(key: string, text: string): void {
    if (key === "model_name") {
      this._modelName = text || "我的数字模型";
    }
  }

  onUnmount(): void {
    this.trainGeneration++;
    this.running = false;
    this.paused = false;
  }

  pause(): void {
    if (this.running) {
      this.paused = true;
      this.running = false;
    }
    super.pause();
  }

  // ---------------------------------------------------------------------
  // Dataset loading
  // ---------------------------------------------------------------------

  private async loadDataset(): Promise<void> {
    this.trainGeneration++;
    const gen = this.trainGeneration;
    try {
      const ds = await fetchDataset("digits", this.getAbortSignal());
      if (gen !== this.trainGeneration) return;
      this.dataset = ds;
      this.currentWeights = [];
      this.currentBiases = [];
      this.currentOptimizerState = null;
      this.currentEpoch = 0;
      this.lossHistory = [];
      this.accHistory = [];
      this.loadedModelId = null;
      this.loadedModelName = null;
      this.drawingMode = false;
      this.isDrawing = false;
      this.buildLayout();
      this.setVisualizationStatus("idle");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      this.setVisualizationStatus("error");
    }
  }

  // ---------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------

  private computeRegions(): void {
    const w = this.width;
    const h = this.height;
    const gap = 8;
    const halfW = (w - gap) / 2;
    const halfH = (h - gap) / 2;
    this.pixelRegion = { x: 0, y: 0, w: halfW, h: halfH };
    this.probRegion = { x: halfW + gap, y: 0, w: halfW, h: halfH };
    this.lossRegion = { x: 0, y: halfH + gap, w: halfW, h: halfH };
    this.accRegion = { x: halfW + gap, y: halfH + gap, w: halfW, h: halfH };
  }

  private buildLayout(): void {
    if (!this.dataset) return;
    this.scene.clear();
    this.renderer.clearAnimations();
    this.probBars = [];
    this.probLabels = [];
    this.computeRegions();

    this.buildPixelPanel();
    this.buildProbPanel();
    this.buildLossPanel();
    this.buildAccPanel();
    this.buildStatsText();

    this.renderer.renderOnce();
  }

  private buildPixelPanel(): void {
    const r = this.pixelRegion;
    const title = new Text("输入数字 (8×8)", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    const size = Math.min(r.w - 60, r.h - 60);
    const cellSize = size / DIGIT_PIXEL_RES;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 8;
    const values: number[][] = Array.from({ length: DIGIT_PIXEL_RES }, () =>
      new Array(DIGIT_PIXEL_RES).fill(0),
    );
    const grid = new Grid(cx, cy, values, cellSize);
    grid.valueMin = 0;
    grid.valueMax = 1;
    grid.cellGap = 1;
    this.scene.add(grid);
    this.pixelGrid = grid;

    // Save geometry for mouse-to-pixel mapping during hand-drawing
    this.pixelGeom = { cx, cy, size, cellSize };

    this.trueLabel = new Text("真实: -", cx, cy + size / 2 + 22, 13);
    this.trueLabel.fillStyle = COLORS.textDim;
    this.scene.add(this.trueLabel);
  }

  private buildProbPanel(): void {
    const r = this.probRegion;
    const title = new Text("输出概率 (0-9)", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    const barCount = 10;
    const padX = 30;
    const padTop = 40;
    const padBot = 30;
    const plotW = r.w - padX * 2;
    const barW = plotW / barCount - 4;
    const maxBarH = r.h - padTop - padBot;

    for (let i = 0; i < barCount; i++) {
      const bx = r.x + padX + i * (barW + 4) + barW / 2;
      const by = r.y + r.h - padBot;
      const bar = new Rect(bx, by - maxBarH / 2, barW, 1, 2);
      bar.fillStyle = COLORS.accent;
      bar.opacity = 0.3;
      this.scene.add(bar);
      this.probBars.push(bar);

      const lbl = new Text(`${i}`, bx, by + 12, 11);
      lbl.fillStyle = COLORS.textDim;
      this.scene.add(lbl);
      this.probLabels.push(lbl);
    }

    this.predLabel = new Text("预测: -", r.x + r.w / 2, r.y + 32, 14);
    this.predLabel.fillStyle = COLORS.highlight;
    this.predLabel.fontWeight = "bold";
    this.scene.add(this.predLabel);
  }

  private buildLossPanel(): void {
    const r = this.lossRegion;
    this.scene.setLayer("chart_loss");
    const frame = new Rect(r.x + r.w / 2, r.y + r.h / 2, r.w - 20, r.h - 30, 6);
    frame.fillStyle = "rgba(15, 23, 42, 0.4)";
    frame.strokeStyle = "rgba(71, 85, 105, 0.4)";
    this.scene.add(frame);
    const title = new Text("Loss 曲线", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);
    this.scene.setLayer("default");
  }

  private buildAccPanel(): void {
    const r = this.accRegion;
    this.scene.setLayer("chart_acc");
    const frame = new Rect(r.x + r.w / 2, r.y + r.h / 2, r.w - 20, r.h - 30, 6);
    frame.fillStyle = "rgba(15, 23, 42, 0.4)";
    frame.strokeStyle = "rgba(71, 85, 105, 0.4)";
    this.scene.add(frame);
    const title = new Text("Accuracy 曲线", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);
    this.scene.setLayer("default");
  }

  private buildStatsText(): void {
    const r = this.accRegion;
    this.epochText = new Text("epoch: 0", r.x + 16, r.y + r.h - 22, 11);
    this.epochText.fillStyle = COLORS.accent;
    this.epochText.fontFamily = "monospace";
    this.epochText.align = "left";
    this.scene.add(this.epochText);

    this.lossText = new Text("loss: -", r.x + r.w / 2 - 10, r.y + r.h - 22, 11);
    this.lossText.fillStyle = COLORS.positive;
    this.lossText.fontFamily = "monospace";
    this.lossText.align = "left";
    this.scene.add(this.lossText);

    this.accText = new Text("acc: -", r.x + r.w - 60, r.y + r.h - 22, 11);
    this.accText.fillStyle = COLORS.highlight;
    this.accText.fontFamily = "monospace";
    this.accText.align = "left";
    this.scene.add(this.accText);

    this.modelStatusText = new Text("未加载模型", r.x + r.w / 2, r.y + 36, 11);
    this.modelStatusText.fillStyle = COLORS.textDim;
    this.scene.add(this.modelStatusText);

    this.phaseText = new Text("", r.x + r.w / 2, r.y + 52, 11);
    this.phaseText.fillStyle = COLORS.textDim;
    this.scene.add(this.phaseText);
  }

  // ---------------------------------------------------------------------
  // Training loop
  // ---------------------------------------------------------------------

  private async runTraining(): Promise<void> {
    if (!this.dataset) return;
    const gen = ++this.trainGeneration;
    this.running = true;
    this.paused = false;
    this.setVisualizationStatus("running");

    if (!this.loadedModelId && this.currentWeights.length === 0) {
      this.currentWeights = [];
      this.currentBiases = [];
      this.currentOptimizerState = null;
      this.lossHistory = [];
      this.accHistory = [];
      this.currentEpoch = 0;
    }

    const totalEpochs = Math.floor(this.controls["epochs"] ?? 500);
    const stepSize = 10;
    const layers = this.dataset.suggested_layers;
    const data = this.dataset.data;

    for (let epoch = this.currentEpoch; epoch < totalEpochs; epoch += stepSize) {
      if (gen !== this.trainGeneration) return;
      if (!this.running) return;

      try {
        if (this.phaseText) {
          this.phaseText.text = `训练中… (轮 ${epoch + 1}-${Math.min(epoch + stepSize, totalEpochs)})`;
        }

        const res = await nnTrainStep(
          {
            layers,
            data,
            epochs: stepSize,
            learning_rate: this.controls["lr"] ?? 0.01,
            activation: ACTIVATION,
            seed: 42,
            weights: this.currentWeights.length ? this.currentWeights : undefined,
            biases: this.currentBiases.length ? this.currentBiases : undefined,
            return_predictions: true,
            optimizer_state: this.currentOptimizerState ?? undefined,
          },
          this.getAbortSignal(),
        );

        if (gen !== this.trainGeneration) return;

        this.currentWeights = res.weights;
        this.currentBiases = res.biases;
        this.currentOptimizerState = res.optimizer_state;
        this.currentEpoch = epoch + stepSize;
        this.currentLoss = res.loss_history[res.loss_history.length - 1] ?? 0;
        this.currentAccuracy = res.accuracy ?? null;
        this.lossHistory.push(...res.loss_history);
        if (this.currentAccuracy !== null) this.accHistory.push(this.currentAccuracy);

        this.updateTestSample();
        this.updateLossCurve();
        this.updateAccCurve();
        this.updateStats();
        this.renderer.renderOnce();

        const speed = this.controls["speed"] ?? 1;
        await this.waitForAnimation(500 / speed);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("Training error:", e);
        this.setVisualizationStatus("error");
        this.running = false;
        return;
      }
    }

    this.running = false;
    this.setVisualizationStatus("completed");
    if (this.phaseText) this.phaseText.text = "训练完成 ✓";
  }

  // ---------------------------------------------------------------------
  // In-place updates
  // ---------------------------------------------------------------------

  private get testSampleIdx(): number {
    return Math.floor(this.controls["test_sample"] ?? 0);
  }

  private updateTestSample(): void {
    if (!this.dataset || !this.pixelGrid) return;
    const idx = Math.min(this.testSampleIdx, this.dataset.data.length - 1);
    const sample = this.dataset.data[idx];
    const inputDim = this.dataset.input_dim; // 64
    const pixels = sample.slice(0, inputDim);

    // Update pixel grid (8x8)
    const values: number[][] = [];
    for (let r = 0; r < DIGIT_PIXEL_RES; r++) {
      const row: number[] = [];
      for (let c = 0; c < DIGIT_PIXEL_RES; c++) {
        row.push(pixels[r * DIGIT_PIXEL_RES + c]);
      }
      values.push(row);
    }
    this.pixelGrid.values = values;

    // True label
    const targets = sample.slice(inputDim);
    const trueDigit = targets.indexOf(Math.max(...targets));
    if (this.trueLabel) this.trueLabel.text = `真实: ${trueDigit}`;

    // Classify and update probability bars
    const probs = this.classifyDigit(pixels);
    this.updateProbBars(probs, trueDigit);
  }

  /**
   * Run a frontend forward pass on a 64-length pixel vector.
   * Hidden layers use relu, output layer uses sigmoid (must match training).
   * Returns a 10-element probability array.
   */
  private classifyDigit(pixels: number[]): number[] {
    if (this.currentWeights.length === 0) {
      return new Array(10).fill(0);
    }
    let a = pixels;
    const nLayers = this.currentWeights.length;
    for (let l = 0; l < nLayers; l++) {
      const w = this.currentWeights[l];
      const b = this.currentBiases[l];
      const out: number[] = [];
      for (let o = 0; o < w.length; o++) {
        let z = b[o];
        for (let i = 0; i < a.length; i++) z += w[o][i] * a[i];
        out.push(l === nLayers - 1 ? sigmoid(z) : Math.max(0, z));
      }
      a = out;
    }
    return a;
  }

  // ---------------------------------------------------------------------
  // Hand-drawing: let user paint a digit on the 8×8 grid for testing
  // ---------------------------------------------------------------------

  private switchMode(drawMode: boolean): void {
    this.drawingMode = drawMode;
    if (!this.pixelGrid) return;

    if (drawMode) {
      // Enter hand-draw mode: clear the grid for user input
      this.drawPixels = Array.from({ length: DIGIT_PIXEL_RES }, () =>
        new Array(DIGIT_PIXEL_RES).fill(0),
      );
      this.pixelGrid.values = this.drawPixels.map((r) => [...r]);
      if (this.trueLabel) this.trueLabel.text = "手写输入";
      if (this.predLabel) {
        this.predLabel.text = "预测: -";
        this.predLabel.fillStyle = COLORS.textDim;
      }
      this.updateProbBars(new Array(10).fill(0), -1);
      this.renderer.renderOnce();
    } else {
      // Back to dataset sample mode
      this.updateTestSample();
      this.renderer.renderOnce();
    }
  }

  private clearDrawing(): void {
    if (!this.drawingMode || !this.pixelGrid) return;
    this.drawPixels = Array.from({ length: DIGIT_PIXEL_RES }, () =>
      new Array(DIGIT_PIXEL_RES).fill(0),
    );
    this.pixelGrid.values = this.drawPixels.map((r) => [...r]);
    if (this.predLabel) {
      this.predLabel.text = "预测: -";
      this.predLabel.fillStyle = COLORS.textDim;
    }
    this.updateProbBars(new Array(10).fill(0), -1);
    this.renderer.renderOnce();
  }

  /** Map canvas coordinates to pixel grid cell; returns null if outside. */
  private canvasToPixel(mx: number, my: number): { row: number; col: number } | null {
    const { cx, cy, size, cellSize } = this.pixelGeom;
    const left = cx - size / 2;
    const top = cy - size / 2;
    if (mx < left || mx > left + size || my < top || my > top + size) return null;
    const col = Math.floor((mx - left) / cellSize);
    const row = Math.floor((my - top) / cellSize);
    if (row < 0 || row >= DIGIT_PIXEL_RES || col < 0 || col >= DIGIT_PIXEL_RES)
      return null;
    return { row, col };
  }

  /** Paint a cell and its neighbours with a soft brush (Gaussian-like falloff). */
  private paintCell(row: number, col: number): void {
    // Only paint the center cell + light touch on 4 orthogonal neighbours
    // (no diagonals). On an 8×8 grid a 3×3 full brush is far too large.
    this.drawPixels[row][col] = 1.0;
    const neighbours = [
      [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1],
    ];
    for (const [r, c] of neighbours) {
      if (r >= 0 && r < DIGIT_PIXEL_RES && c >= 0 && c < DIGIT_PIXEL_RES) {
        this.drawPixels[r][c] = Math.max(this.drawPixels[r][c], 0.3);
      }
    }
  }

  private startDraw(mx: number, my: number): void {
    if (!this.drawingMode || !this.pixelGrid) return;
    const cell = this.canvasToPixel(mx, my);
    if (!cell) return;
    this.isDrawing = true;
    this.paintCell(cell.row, cell.col);
    this.pixelGrid.values = this.drawPixels.map((r) => [...r]);
    this.renderer.renderOnce();
  }

  private continueDraw(mx: number, my: number): void {
    if (!this.isDrawing || !this.drawingMode || !this.pixelGrid) return;
    const cell = this.canvasToPixel(mx, my);
    if (!cell) return;
    this.paintCell(cell.row, cell.col);
    this.pixelGrid.values = this.drawPixels.map((r) => [...r]);
    // Live classification while drawing (if model is trained)
    if (this.currentWeights.length > 0) {
      const flat = this.drawPixels.flat();
      const probs = this.classifyDigit(flat);
      this.updateProbBars(probs, -1);
    }
    this.renderer.renderOnce();
  }

  private endDraw(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    // Final classification
    if (this.currentWeights.length > 0 && this.pixelGrid) {
      const flat = this.drawPixels.flat();
      const probs = this.classifyDigit(flat);
      const predDigit = probs.indexOf(Math.max(...probs));
      this.updateProbBars(probs, -1);
      if (this.predLabel) {
        this.predLabel.text = `预测: ${predDigit}`;
        this.predLabel.fillStyle = COLORS.highlight;
      }
      this.renderer.renderOnce();
    }
  }

  private updateProbBars(probs: number[], trueDigit: number): void {
    const r = this.probRegion;
    const padTop = 50;
    const padBot = 30;
    const maxBarH = r.h - padTop - padBot;
    const maxProb = Math.max(...probs, 0.01);
    const predDigit = probs.indexOf(maxProb);

    for (let i = 0; i < this.probBars.length; i++) {
      const bar = this.probBars[i];
      const h = Math.max(1, (probs[i] / maxProb) * maxBarH);
      bar.height = h;
      bar.y = r.y + r.h - padBot - h / 2;
      bar.opacity = 0.4 + probs[i] * 0.6;
      if (i === predDigit) {
        // Highlight the predicted digit. Green if correct (trueDigit >= 0
        // and matches), otherwise highlight color. When trueDigit < 0
        // (hand-drawn, no ground truth) use highlight.
        bar.fillStyle =
          trueDigit >= 0 && predDigit === trueDigit
            ? COLORS.positive
            : COLORS.highlight;
      } else {
        bar.fillStyle = COLORS.accent;
      }
    }

    // Only update predLabel here for dataset mode; hand-draw mode manages
    // its own label text (since trueDigit is -1 / unknown).
    if (this.predLabel && trueDigit >= 0) {
      this.predLabel.text = `预测: ${predDigit}`;
      this.predLabel.fillStyle =
        predDigit === trueDigit ? COLORS.positive : COLORS.negative;
    }
  }

  private updateLossCurve(): void {
    const r = this.lossRegion;
    this.scene.clear("chart_loss");
    this.scene.setLayer("chart_loss");

    const frame = new Rect(r.x + r.w / 2, r.y + r.h / 2, r.w - 20, r.h - 30, 6);
    frame.fillStyle = "rgba(15, 23, 42, 0.4)";
    frame.strokeStyle = "rgba(71, 85, 105, 0.4)";
    this.scene.add(frame);
    const title = new Text("Loss 曲线", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    if (this.lossHistory.length < 2) {
      this.scene.setLayer("default");
      return;
    }

    const padX = 20;
    const padTop = 30;
    const padBot = 20;
    const plotW = r.w - padX * 2;
    const plotH = r.h - padTop - padBot;
    const maxLoss = Math.max(...this.lossHistory, 0.01);

    for (let i = 1; i < this.lossHistory.length; i++) {
      const x1 = r.x + padX + ((i - 1) / (this.lossHistory.length - 1)) * plotW;
      const y1 = r.y + padTop + plotH - (this.lossHistory[i - 1] / maxLoss) * plotH;
      const x2 = r.x + padX + (i / (this.lossHistory.length - 1)) * plotW;
      const y2 = r.y + padTop + plotH - (this.lossHistory[i] / maxLoss) * plotH;
      const seg = new Line(x1, y1, x2, y2);
      seg.strokeStyle = COLORS.positive;
      seg.lineWidth = 2;
      this.scene.add(seg);
    }

    this.scene.setLayer("default");
  }

  private updateAccCurve(): void {
    const r = this.accRegion;
    this.scene.clear("chart_acc");
    this.scene.setLayer("chart_acc");

    const frame = new Rect(r.x + r.w / 2, r.y + r.h / 2, r.w - 20, r.h - 30, 6);
    frame.fillStyle = "rgba(15, 23, 42, 0.4)";
    frame.strokeStyle = "rgba(71, 85, 105, 0.4)";
    this.scene.add(frame);
    const title = new Text("Accuracy 曲线", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    if (this.accHistory.length < 2) {
      this.scene.setLayer("default");
      return;
    }

    const padX = 20;
    const padTop = 30;
    const padBot = 20;
    const plotW = r.w - padX * 2;
    const plotH = r.h - padTop - padBot;

    for (let i = 1; i < this.accHistory.length; i++) {
      const x1 = r.x + padX + ((i - 1) / (this.accHistory.length - 1)) * plotW;
      const y1 = r.y + padTop + plotH - this.accHistory[i - 1] * plotH;
      const x2 = r.x + padX + (i / (this.accHistory.length - 1)) * plotW;
      const y2 = r.y + padTop + plotH - this.accHistory[i] * plotH;
      const seg = new Line(x1, y1, x2, y2);
      seg.strokeStyle = COLORS.highlight;
      seg.lineWidth = 2;
      this.scene.add(seg);
    }

    this.scene.setLayer("default");
  }

  private updateStats(): void {
    if (this.epochText) this.epochText.text = `epoch: ${this.currentEpoch}`;
    if (this.lossText)
      this.lossText.text = this.currentLoss > 0 ? `loss: ${this.currentLoss.toFixed(4)}` : "loss: -";
    if (this.accText) {
      this.accText.text =
        this.currentAccuracy !== null
          ? `acc: ${(this.currentAccuracy * 100).toFixed(1)}%`
          : "acc: -";
    }
    if (this.modelStatusText) {
      this.modelStatusText.text = this.loadedModelName
        ? `已加载: ${this.loadedModelName}`
        : "未加载模型";
    }
  }

  // ---------------------------------------------------------------------
  // Model save / load
  // ---------------------------------------------------------------------

  private async handleSaveModel(): Promise<void> {
    if (!this.dataset || this.currentWeights.length === 0) {
      this.flashModelStatus("请先训练模型");
      return;
    }
    try {
      const res = await saveModel(
        {
          name: this._modelName,
          dataset: this.dataset.name,
          layers: this.dataset.suggested_layers,
          activation: ACTIVATION,
          weights: this.currentWeights,
          biases: this.currentBiases,
          epoch: this.currentEpoch,
          loss: this.currentLoss,
          accuracy: this.currentAccuracy,
          overwrite_id: this.loadedModelId ?? undefined,
          optimizer_state: this.currentOptimizerState ?? undefined,
        },
        this.getAbortSignal(),
      );
      this.loadedModelId = res.id;
      this.loadedModelName = res.name;
      this.updateStats();
      this.renderer.renderOnce();
      this.flashModelStatus(`已保存: ${res.name}`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      this.flashModelStatus("保存失败");
    }
  }

  private async handleLoadModel(): Promise<void> {
    try {
      const models = await fetchSavedModels(this.getAbortSignal());
      this.savedModels = models;
      if (models.length === 0) {
        this.flashModelStatus("暂无已保存模型");
        return;
      }
      // Prefer a digits dataset model
      const target = models.find((m) => m.dataset === "digits") ?? models[0];
      const detail = await loadModel(target.id, this.getAbortSignal());
      this.currentWeights = detail.weights;
      this.currentBiases = detail.biases;
      this.currentOptimizerState = detail.optimizer_state ?? null;
      this.currentEpoch = detail.epoch;
      this.currentLoss = detail.loss;
      this.currentAccuracy = detail.accuracy ?? null;
      this.loadedModelId = detail.id;
      this.loadedModelName = detail.name;
      this.lossHistory = [detail.loss];
      this.accHistory = this.currentAccuracy !== null ? [this.currentAccuracy] : [];

      this.updateTestSample();
      this.updateLossCurve();
      this.updateAccCurve();
      this.updateStats();
      this.renderer.renderOnce();
      this.flashModelStatus(`已加载: ${detail.name} (epoch ${detail.epoch})`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      this.flashModelStatus("加载失败");
    }
  }

  private flashModelStatus(msg: string): void {
    if (this.modelStatusText) {
      this.modelStatusText.text = msg;
      this.modelStatusText.fillStyle = COLORS.highlight;
      this.renderer.renderOnce();
      setTimeout(() => {
        if (this.modelStatusText) {
          this.modelStatusText.fillStyle = COLORS.textDim;
          this.updateStats();
          this.renderer.renderOnce();
        }
      }, 2500);
    }
  }
}
