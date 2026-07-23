/** LiveTrainViz - watch a neural network learn to classify in real time.

Four-quadrant layout:
  ┌──────────────┬──────────────┐
  │ Network graph│  Loss curve  │
  │ (nodes glow  │  (grows live)│
  │  by activate)│              │
  ├──────────────┼──────────────┤
  │ Decision     │  Stats panel │
  │ boundary     │  epoch/loss/ │
  │ (heatmap +   │  acc + save/ │
  │  data points)│  load hint   │
  └──────────────┴──────────────┘

Training runs step-by-step via /nn/train/step with warm-start, so the user
can pause/resume and watch the decision boundary evolve.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { MouseHandler } from "@/canvas/interaction/MouseHandler";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { Rect } from "@/canvas/shapes/Rect";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Grid } from "@/canvas/shapes/Grid";
import { COLORS } from "@/utils/color";
import { colormapHue, normalizeLayer } from "@/utils/colormap";
import { sigmoid, tanh } from "@/utils/math";
import {
  nnTrainStep,
  fetchDataset,
  fetchSavedModels,
  saveModel,
  loadModel,
} from "@/api/compute";
import type { DatasetResponse, SavedModelSummary, OptimizerState } from "@/types/api";

// --- Layout regions -------------------------------------------------------

interface Region {
  x: number; y: number; w: number; h: number;
}

interface NodeInfo {
  glowNode: GlowNode;
  x: number;
  y: number;
}

interface EdgeInfo {
  line: Line;
  fromLayer: number;
  fromIdx: number;
  toIdx: number;
}

const DATASET_NAMES = ["xor", "moons", "circles", "spiral"];
const BOUNDARY_RES = 40; // grid resolution for decision boundary
const ACTIVATION = "tanh"; // hidden layer activation (stronger gradients than sigmoid)

export class LiveTrainViz extends BaseVisualization {
  private trainGeneration = 0;
  private running = false;
  private paused = false;

  // Training state
  private currentWeights: number[][][] = [];
  private currentBiases: number[][] = [];
  private currentOptimizerState: OptimizerState | null = null;
  private currentEpoch = 0;
  private currentLoss = 0;
  private currentAccuracy: number | null = null;
  private lossHistory: number[] = [];
  private loadedModelId: string | null = null;
  private loadedModelName: string | null = null;

  // Dataset
  private dataset: DatasetResponse | null = null;
  private datasetLoading = false;

  // Scene objects (built once, mutated in place)
  private nodes: NodeInfo[][] = [];
  private edges: EdgeInfo[] = [];
  private boundaryGrid: Grid | null = null;
  private boundaryScatter: Circle[] = [];
  private epochText: Text | null = null;
  private lossText: Text | null = null;
  private accText: Text | null = null;
  private modelStatusText: Text | null = null;
  private phaseText: Text | null = null;

  // Boundary geometry for click-to-test (saved during buildBoundaryPanel)
  private boundaryGeom = { cx: 0, cy: 0, halfSize: 0 };

  // Saved models list (for load overlay)
  private savedModels: SavedModelSummary[] = [];
  private showLoadOverlay = false;

  // Layout regions
  private netRegion!: Region;
  private chartRegion!: Region;
  private boundaryRegion!: Region;
  private statsRegion!: Region;

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  onMount(): void {
    if (!this.mouseHandler) {
      this.mouseHandler = new MouseHandler(this.canvas);
    }
    this.mouseHandler.onClick((x, y) => this.handleBoundaryClick(x, y));
    this.loadDataset(this.datasetName);
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run") {
      if (this.paused) {
        // Resume from pause
        this.paused = false;
        this.running = true;
        this.resume();
        return;
      }
      if (!this.running) {
        this.runTraining();
      }
      return;
    }
    if (key === "dataset") {
      this.resetTraining();
      this.loadDataset(this.datasetName);
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
      this._modelName = text || "我的模型";
    }
  }

  onUnmount(): void {
    this.trainGeneration++;
    this.running = false;
    this.paused = false;
  }

  // Override pause/resume to track our running state
  pause(): void {
    if (this.running) {
      this.paused = true;
      this.running = false;
    }
    super.pause();
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private get datasetName(): string {
    const idx = Math.floor(this.controls["dataset"] ?? 1);
    return DATASET_NAMES[idx] ?? "moons";
  }

  private _modelName = "我的模型";

  // Override onTextChange to capture model name
  // (BaseVisualization calls onTextChange; we store it)
  // ---------------------------------------------------------------------
  // Dataset loading
  // ---------------------------------------------------------------------

  private async loadDataset(name: string): Promise<void> {
    this.datasetLoading = true;
    this.trainGeneration++;
    const gen = this.trainGeneration;
    try {
      const ds = await fetchDataset(name, this.getAbortSignal());
      if (gen !== this.trainGeneration) return;
      this.dataset = ds;
      this.currentWeights = [];
      this.currentBiases = [];
      this.currentOptimizerState = null;
      this.currentEpoch = 0;
      this.currentLoss = 0;
      this.currentAccuracy = null;
      this.lossHistory = [];
      this.loadedModelId = null;
      this.loadedModelName = null;
      this.buildLayout();
      this.setVisualizationStatus("idle");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      this.setVisualizationStatus("error");
    } finally {
      this.datasetLoading = false;
    }
  }

  // ---------------------------------------------------------------------
  // Layout - build the static scene once
  // ---------------------------------------------------------------------

  private computeRegions(): void {
    const w = this.width;
    const h = this.height;
    const gap = 8;
    const halfW = (w - gap) / 2;
    const halfH = (h - gap) / 2;
    this.netRegion = { x: 0, y: 0, w: halfW, h: halfH };
    this.chartRegion = { x: halfW + gap, y: 0, w: halfW, h: halfH };
    this.boundaryRegion = { x: 0, y: halfH + gap, w: halfW, h: halfH };
    this.statsRegion = { x: halfW + gap, y: halfH + gap, w: halfW, h: halfH };
  }

  private buildLayout(): void {
    if (!this.dataset) return;
    this.scene.clear();
    this.renderer.clearAnimations();
    this.nodes = [];
    this.edges = [];
    this.boundaryScatter = [];
    this.computeRegions();

    this.buildNetworkPanel();
    this.buildChartPanel();
    this.buildBoundaryPanel();
    this.buildStatsPanel();

    this.renderer.renderOnce();
  }

  // --- Network panel (top-left) ---

  private buildNetworkPanel(): void {
    const r = this.netRegion;
    if (!this.dataset) return;
    const layers = this.dataset.suggested_layers;

    // Panel title
    const title = new Text("网络结构", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    const padX = 50;
    const padY = 44;
    const usableW = r.w - padX * 2;
    const layerX = layers.map(
      (_, i) => r.x + padX + (i / Math.max(1, layers.length - 1)) * usableW,
    );
    const maxNodes = Math.max(...layers);
    const spacing = Math.min(45, (r.h - padY * 2) / Math.max(maxNodes, 1));
    const cy = r.y + r.h / 2 + 4;
    const radius = Math.min(16, spacing * 0.32);

    for (let l = 0; l < layers.length; l++) {
      const count = layers[l];
      const totalH = (count - 1) * spacing;
      const startY = cy - totalH / 2;
      const layerNodes: NodeInfo[] = [];
      const hue = l === 0 ? 180 : l === layers.length - 1 ? 30 : 260;

      for (let i = 0; i < count; i++) {
        const x = layerX[l];
        const y = startY + i * spacing;
        const gn = new GlowNode(x, y, radius);
        gn.hue = hue;
        gn.intensity = 0.1;
        gn.glowScale = 2.2;
        if (l === 0) gn.label = `x${i + 1}`;
        else if (l === layers.length - 1) gn.label = "y";
        else gn.label = `h${i + 1}`;
        gn.labelSize = 9;
        this.scene.add(gn);
        layerNodes.push({ glowNode: gn, x, y });
      }
      this.nodes.push(layerNodes);

      // Layer label
      const lbl = l === 0 ? "输入" : l === layers.length - 1 ? "输出" : `隐藏${l}`;
      const lblText = new Text(`${lbl} [${count}]`, layerX[l], r.y + 36, 10);
      lblText.fillStyle = COLORS.textDim;
      this.scene.add(lblText);
    }

    // Edges
    for (let l = 0; l < layers.length - 1; l++) {
      const fromLayer = this.nodes[l];
      const toLayer = this.nodes[l + 1];
      for (let i = 0; i < toLayer.length; i++) {
        for (let j = 0; j < fromLayer.length; j++) {
          const from = fromLayer[j];
          const to = toLayer[i];
          const line = new Line(from.x, from.y, to.x, to.y);
          line.strokeStyle = "rgba(71, 85, 105, 0.3)";
          line.lineWidth = 1;
          this.scene.add(line);
          this.edges.push({
            line,
            fromLayer: l,
            fromIdx: j,
            toIdx: i,
          });
        }
      }
    }
  }

  // --- Chart panel (top-right) ---

  private buildChartPanel(): void {
    const r = this.chartRegion;
    this.scene.setLayer("chart");
    // Frame
    const frame = new Rect(r.x + r.w / 2, r.y + r.h / 2, r.w - 20, r.h - 30, 6);
    frame.fillStyle = "rgba(15, 23, 42, 0.4)";
    frame.strokeStyle = "rgba(71, 85, 105, 0.4)";
    frame.lineWidth = 1;
    this.scene.add(frame);
    const title = new Text("Loss 曲线", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);
    this.scene.setLayer("default");
  }

  // --- Boundary panel (bottom-left) ---

  private buildBoundaryPanel(): void {
    const r = this.boundaryRegion;
    if (!this.dataset || this.dataset.input_dim !== 2) return;

    const title = new Text("决策边界", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    // Compute boundary region bounds (square, centered)
    const size = Math.min(r.w - 30, r.h - 40);
    const cellSize = size / BOUNDARY_RES;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 8;

    // Initialize grid with 0.5 (neutral)
    const values: number[][] = Array.from({ length: BOUNDARY_RES }, () =>
      new Array(BOUNDARY_RES).fill(0.5),
    );
    const grid = new Grid(cx, cy, values, cellSize);
    grid.valueMin = 0;
    grid.valueMax = 1;
    grid.cellGap = 0;
    this.scene.add(grid);
    this.boundaryGrid = grid;

    // Save geometry for click-to-test classification
    this.boundaryGeom = { cx, cy, halfSize: size / 2 };

    // Scatter data points
    const points = this.dataset.points;
    if (points.length > 0) {
      // Compute data bounds
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      const xPad = (xMax - xMin) * 0.15 || 1;
      const yPad = (yMax - yMin) * 0.15 || 1;
      this.dataBounds = {
        xMin: xMin - xPad,
        xMax: xMax + xPad,
        yMin: yMin - yPad,
        yMax: yMax + yPad,
      };

      const halfSize = size / 2;
      for (const p of points) {
        const px = cx + ((p[0] - (xMin + xMax) / 2) / ((xMax - xMin) / 2 + xPad)) * halfSize;
        const py = cy - ((p[1] - (yMin + yMax) / 2) / ((yMax - yMin) / 2 + yPad)) * halfSize;
        const dot = new Circle(px, py, 3.5);
        dot.fillStyle = p[2] === 0 ? COLORS.accent : COLORS.negative;
        dot.strokeStyle = "rgba(255,255,255,0.4)";
        dot.lineWidth = 0.5;
        this.scene.add(dot);
        this.boundaryScatter.push(dot);
      }
    }
  }

  private dataBounds = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };

  // --- Stats panel (bottom-right) ---

  private buildStatsPanel(): void {
    const r = this.statsRegion;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    const title = new Text("训练状态", cx, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    const y0 = r.y + 48;
    const lblEpoch = new Text("Epoch", cx - 70, y0, 11);
    lblEpoch.fillStyle = COLORS.textDim;
    lblEpoch.align = "left";
    this.scene.add(lblEpoch);
    this.epochText = new Text("0", cx + 70, y0, 16);
    this.epochText.fillStyle = COLORS.accent;
    this.epochText.fontFamily = "monospace";
    this.epochText.fontWeight = "bold";
    this.epochText.align = "right";
    this.scene.add(this.epochText);

    const y1 = y0 + 28;
    const lblLoss = new Text("Loss", cx - 70, y1, 11);
    lblLoss.fillStyle = COLORS.textDim;
    lblLoss.align = "left";
    this.scene.add(lblLoss);
    this.lossText = new Text("—", cx + 70, y1, 16);
    this.lossText.fillStyle = COLORS.positive;
    this.lossText.fontFamily = "monospace";
    this.lossText.fontWeight = "bold";
    this.lossText.align = "right";
    this.scene.add(this.lossText);

    const y2 = y1 + 28;
    const lblAcc = new Text("Accuracy", cx - 70, y2, 11);
    lblAcc.fillStyle = COLORS.textDim;
    lblAcc.align = "left";
    this.scene.add(lblAcc);
    this.accText = new Text("—", cx + 70, y2, 16);
    this.accText.fillStyle = COLORS.highlight;
    this.accText.fontFamily = "monospace";
    this.accText.fontWeight = "bold";
    this.accText.align = "right";
    this.scene.add(this.accText);

    // Model status line
    const y3 = y2 + 30;
    this.modelStatusText = new Text("未加载模型", cx, y3, 11);
    this.modelStatusText.fillStyle = COLORS.textDim;
    this.scene.add(this.modelStatusText);

    // Phase indicator
    const y4 = y3 + 22;
    this.phaseText = new Text("", cx, y4, 11);
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

    // If no loaded model and no existing weights, fresh start
    if (!this.loadedModelId && this.currentWeights.length === 0) {
      this.currentWeights = [];
      this.currentBiases = [];
      this.currentOptimizerState = null;
      this.lossHistory = [];
      this.currentEpoch = 0;
    }

    const totalEpochs = Math.floor(this.controls["epochs"] ?? 200);
    const stepSize = 3; // epochs per API call
    const layers = this.dataset.suggested_layers;
    const data = this.dataset.data;

    for (
      let epoch = this.currentEpoch;
      epoch < totalEpochs;
      epoch += stepSize
    ) {
      if (gen !== this.trainGeneration) return;
      if (!this.running) return; // paused or stopped

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

        // In-place updates (no scene.clear)
        this.updateNetworkGraph(res.predictions);
        this.updateDecisionBoundary();
        this.updateLossCurve();
        this.updateStats();
        this.renderer.renderOnce();

        this.setControlValue("epoch", this.currentEpoch);

        // Pause-aware pacing
        const speed = this.controls["speed"] ?? 1;
        await this.waitForAnimation(400 / speed);
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
    if (this.phaseText) {
      this.phaseText.text = "训练完成 ✓";
    }
  }

  private resetTraining(): void {
    this.trainGeneration++;
    this.running = false;
    this.paused = false;
    this.renderer.clearAnimations();
    this.cancelRequests();
    this.scene.clear("test");
    this.currentWeights = [];
    this.currentBiases = [];
    this.currentOptimizerState = null;
    this.currentEpoch = 0;
    this.currentLoss = 0;
    this.currentAccuracy = null;
    this.lossHistory = [];
    this.loadedModelId = null;
    this.loadedModelName = null;
  }

  // ---------------------------------------------------------------------
  // In-place visual updates
  // ---------------------------------------------------------------------

  private updateNetworkGraph(predictions: number[][] | undefined): void {
    if (!this.dataset || !predictions || predictions.length === 0) return;
    // Use output predictions to light up output layer
    const layers = this.dataset.suggested_layers;
    const outputLayer = this.nodes[layers.length - 1];
    if (outputLayer) {
      // For binary (1 output), predictions[i] = [val]
      // Normalize across samples for display
      const vals = predictions.map((p) => p[0]);
      const normed = normalizeLayer(vals);
      // Show average activation per output neuron
      const avgAct = vals.reduce((a, b) => a + b, 0) / vals.length;
      for (let i = 0; i < outputLayer.length; i++) {
        outputLayer[i].glowNode.intensity = 0.2 + avgAct * 0.6;
        outputLayer[i].glowNode.hue = colormapHue(avgAct);
      }
    }

    // Update edges by weight sign/magnitude
    for (const edge of this.edges) {
      const wMat = this.currentWeights[edge.fromLayer];
      if (!wMat || !wMat[edge.toIdx]) continue;
      const w = wMat[edge.toIdx][edge.fromIdx];
      const mag = Math.min(1, Math.abs(w));
      edge.line.strokeStyle =
        w >= 0
          ? `rgba(66, 199, 212, ${0.15 + mag * 0.5})`
          : `rgba(239, 106, 106, ${0.15 + mag * 0.5})`;
      edge.line.lineWidth = 0.5 + mag * 2;
    }
  }

  private updateDecisionBoundary(): void {
    if (!this.boundaryGrid || !this.dataset || this.dataset.input_dim !== 2) return;
    if (this.currentWeights.length === 0) return;

    const { xMin, xMax, yMin, yMax } = this.dataBounds;
    const n = BOUNDARY_RES;
    const values: number[][] = [];
    const nLayers = this.currentWeights.length;

    for (let r = 0; r < n; r++) {
      const row: number[] = [];
      // r=0 is top of grid; map to yMax
      const py = yMax - ((r + 0.5) / n) * (yMax - yMin);
      for (let c = 0; c < n; c++) {
        const px = xMin + ((c + 0.5) / n) * (xMax - xMin);
        // Forward pass for this point (hidden=tanh, output=sigmoid)
        let a = [px, py];
        for (let l = 0; l < nLayers; l++) {
          const w = this.currentWeights[l];
          const b = this.currentBiases[l];
          const out: number[] = [];
          for (let o = 0; o < w.length; o++) {
            let z = b[o];
            for (let i = 0; i < a.length; i++) {
              z += w[o][i] * a[i];
            }
            out.push(l === nLayers - 1 ? sigmoid(z) : tanh(z));
          }
          a = out;
        }
        row.push(a[0]); // binary: single output
      }
      values.push(row);
    }
    this.boundaryGrid.values = values;
  }

  private updateLossCurve(): void {
    const r = this.chartRegion;
    this.scene.clear("chart");
    this.scene.setLayer("chart");

    // Frame
    const frame = new Rect(r.x + r.w / 2, r.y + r.h / 2, r.w - 20, r.h - 30, 6);
    frame.fillStyle = "rgba(15, 23, 42, 0.4)";
    frame.strokeStyle = "rgba(71, 85, 105, 0.4)";
    frame.lineWidth = 1;
    this.scene.add(frame);

    const title = new Text("Loss 曲线", r.x + r.w / 2, r.y + 18, 13);
    title.fillStyle = COLORS.textDim;
    this.scene.add(title);

    if (this.lossHistory.length < 2) {
      this.scene.setLayer("default");
      return;
    }

    const padX = 30;
    const padTop = 35;
    const padBot = 20;
    const plotX = r.x + padX;
    const plotY = r.y + padTop;
    const plotW = r.w - padX * 2;
    const plotH = r.h - padTop - padBot;
    const maxLoss = Math.max(...this.lossHistory, 0.01);

    // Draw line segments
    for (let i = 1; i < this.lossHistory.length; i++) {
      const x1 = plotX + ((i - 1) / (this.lossHistory.length - 1)) * plotW;
      const y1 = plotY + plotH - (this.lossHistory[i - 1] / maxLoss) * plotH;
      const x2 = plotX + (i / (this.lossHistory.length - 1)) * plotW;
      const y2 = plotY + plotH - (this.lossHistory[i] / maxLoss) * plotH;
      const seg = new Line(x1, y1, x2, y2);
      seg.strokeStyle = COLORS.positive;
      seg.lineWidth = 2;
      this.scene.add(seg);
    }

    // Current point glow
    const lastIdx = this.lossHistory.length - 1;
    const hx = plotX + (lastIdx / (this.lossHistory.length - 1)) * plotW;
    const hy = plotY + plotH - (this.lossHistory[lastIdx] / maxLoss) * plotH;
    const dot = new Circle(hx, hy, 4);
    dot.fillStyle = COLORS.positive;
    this.scene.add(dot);

    const lossLabel = new Text(
      `${this.lossHistory[lastIdx].toFixed(4)}`,
      hx + 8,
      hy - 8,
      11,
    );
    lossLabel.fillStyle = COLORS.positive;
    lossLabel.fontFamily = "monospace";
    lossLabel.align = "left";
    this.scene.add(lossLabel);

    this.scene.setLayer("default");
  }

  private updateStats(): void {
    if (this.epochText) this.epochText.text = `${this.currentEpoch}`;
    if (this.lossText)
      this.lossText.text = this.currentLoss > 0 ? this.currentLoss.toFixed(4) : "—";
    if (this.accText) {
      this.accText.text =
        this.currentAccuracy !== null
          ? `${(this.currentAccuracy * 100).toFixed(1)}%`
          : "—";
    }
    if (this.modelStatusText) {
      this.modelStatusText.text = this.loadedModelName
        ? `已加载: ${this.loadedModelName}`
        : "未加载模型";
    }
  }

  // ---------------------------------------------------------------------
  // Click-to-test: classify an arbitrary point on the decision boundary
  // ---------------------------------------------------------------------

  private handleBoundaryClick(mx: number, my: number): void {
    if (!this.dataset || this.dataset.input_dim !== 2) return;
    if (this.currentWeights.length === 0) {
      this.flashModelStatus("请先训练模型");
      return;
    }

    const { cx, cy, halfSize } = this.boundaryGeom;
    // Ignore clicks outside the boundary square
    if (Math.abs(mx - cx) > halfSize || Math.abs(my - cy) > halfSize) return;

    // Canvas coords -> data coords (inverse of the scatter mapping)
    const { xMin, xMax, yMin, yMax } = this.dataBounds;
    const xMid = (xMin + xMax) / 2;
    const yMid = (yMin + yMax) / 2;
    const xHalf = (xMax - xMin) / 2 + (xMax - xMin) * 0.15;
    const yHalf = (yMax - yMin) / 2 + (yMax - yMin) * 0.15;
    const dataX = xMid + ((mx - cx) / halfSize) * xHalf;
    const dataY = yMid - ((my - cy) / halfSize) * yHalf;

    // Frontend forward pass (hidden=tanh, output=sigmoid)
    let a = [dataX, dataY];
    const nLayers = this.currentWeights.length;
    for (let l = 0; l < nLayers; l++) {
      const w = this.currentWeights[l];
      const b = this.currentBiases[l];
      const out: number[] = [];
      for (let o = 0; o < w.length; o++) {
        let z = b[o];
        for (let i = 0; i < a.length; i++) z += w[o][i] * a[i];
        out.push(l === nLayers - 1 ? sigmoid(z) : tanh(z));
      }
      a = out;
    }
    const prob = a[0]; // binary: single sigmoid output in [0,1]
    this.showTestPoint(mx, my, prob, dataX, dataY);
  }

  private showTestPoint(
    mx: number,
    my: number,
    prob: number,
    dataX: number,
    dataY: number,
  ): void {
    this.scene.clear("test");
    this.scene.setLayer("test");

    const isClass1 = prob > 0.5;
    const dot = new Circle(mx, my, 6);
    dot.fillStyle = isClass1 ? COLORS.negative : COLORS.accent;
    dot.strokeStyle = "rgba(255,255,255,0.8)";
    dot.lineWidth = 1.5;
    this.scene.add(dot);

    const label = isClass1 ? "类别 1" : "类别 0";
    const confidence = isClass1 ? prob : 1 - prob;
    const txt = new Text(
      `${label} (${(confidence * 100).toFixed(0)}%)`,
      mx,
      my - 16,
      12,
    );
    txt.fillStyle = isClass1 ? COLORS.negative : COLORS.accent;
    txt.fontWeight = "bold";
    txt.align = "center";
    this.scene.add(txt);

    // Data coords subtitle (smaller, dim)
    const coordTxt = new Text(
      `(${dataX.toFixed(2)}, ${dataY.toFixed(2)})`,
      mx,
      my + 20,
      9,
    );
    coordTxt.fillStyle = COLORS.textDim;
    coordTxt.align = "center";
    this.scene.add(coordTxt);

    this.scene.setLayer("default");
    this.renderer.renderOnce();
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
      this.scene.clear("test");
      const models = await fetchSavedModels(this.getAbortSignal());
      this.savedModels = models;
      if (models.length === 0) {
        this.flashModelStatus("暂无已保存模型");
        return;
      }
      // Load the most recent model
      const target = models[0];
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

      // If the loaded model's dataset differs from current, switch
      if (this.dataset && detail.dataset !== this.dataset.name) {
        const dsIdx = DATASET_NAMES.indexOf(detail.dataset);
        if (dsIdx >= 0) {
          this.setControlValue("dataset", dsIdx);
          await this.loadDataset(detail.dataset);
          if (!this.dataset) return;
          this.currentWeights = detail.weights;
          this.currentBiases = detail.biases;
          this.currentOptimizerState = detail.optimizer_state ?? null;
        }
      }

      this.updateNetworkGraph(undefined);
      // Re-derive predictions for display
      this.updateDecisionBoundary();
      this.updateLossCurve();
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
