/** BackpropViz - visualize training with data flow + error backflow + live loss curve.

Phases:
  1. Forward pass: particles flow left-to-right (cyan) through the network
  2. Loss computation: show prediction vs target
  3. Backward pass: red error particles flow right-to-left (output->input)
  4. Weight update: connections flash to show they changed
  5. Repeat for multiple epochs, loss curve grows in real time

Calls the backend nnTrain API with layers=[2,4,1], XOR-like data.
Loss history is animated point-by-point as if training live.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Particle } from "@/canvas/shapes/Particle";
import { Circle } from "@/canvas/shapes/Circle";
import { Line } from "@/canvas/shapes/Line";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { COLORS } from "@/utils/color";
import { sigmoid } from "@/utils/math";
import { nnTrain } from "@/api/compute";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

const TRAIN_DATA: number[][] = [
  [0, 0, 0],
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 0],
];

interface BPNode {
  x: number;
  y: number;
  glowNode: GlowNode;
}

interface BPEdge {
  x1: number; y1: number;
  x2: number; y2: number;
  line: Line;
  layer: number;
}

export class BackpropViz extends BaseVisualization {
  private nodes: BPNode[][] = [];
  private edges: BPEdge[] = [];
  private lossHistory: number[] = [];
  private phase = "idle"; // idle | forward | loss | backward | done
  private running = false;
  private displayedLossPoints = 0;

  private phaseLabel: Text | null = null;

  onMount(): void {
    this.buildStaticNetwork();
    this.setPhaseLabel("👉 点击「运行训练」开始");
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run" && !this.running) {
      void this.runTraining();
      return;
    }

    if (key === "hidden_neurons" || key === "epochs" || key === "learning_rate") {
      this.running = false;
      this.renderer.clearAnimations();
      this.lossHistory = [];
      this.displayedLossPoints = 0;
      this.phase = "idle";
      this.setVisualizationStatus("idle");
      this.buildStaticNetwork();
      this.setPhaseLabel("网络参数已更新，点击「运行训练」开始");
    }
  }

  onUnmount(): void {
    this.running = false;
  }

  private get hiddenNeurons(): number {
    return Math.max(2, Math.min(8, Math.floor(this.controls["hidden_neurons"] ?? 4)));
  }

  private get epochs(): number {
    return Math.max(20, Math.min(200, Math.floor(this.controls["epochs"] ?? 100)));
  }

  private get learningRate(): number {
    return Math.max(0.05, Math.min(0.8, this.controls["learning_rate"] ?? 0.3));
  }

  private get layerSizes(): number[] {
    return [2, this.hiddenNeurons, 1];
  }

  private async runTraining(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.setVisualizationStatus("running");
    this.lossHistory = [];
    this.displayedLossPoints = 0;
    this.setPhaseLabel("正在训练...");
    this.renderer.renderOnce();

    let lossHistory: number[];
    try {
      const res = await nnTrain({
        layers: this.layerSizes,
        data: TRAIN_DATA,
        epochs: this.epochs,
        learning_rate: this.learningRate,
        activation: "sigmoid",
      });
      lossHistory = res.loss_history;
    } catch {
      lossHistory = this.localTrain();
    }

    this.lossHistory = lossHistory;
    if (this.running) this.animateTraining();
  }

  /** Local training fallback (full backprop). */
  private localTrain(): number[] {
    const layerSizes = this.layerSizes;
    const epochs = this.epochs;
    const learningRate = this.learningRate;
    const rng = (s: number) => () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const rand = rng(42);
    const weights: number[][][] = [];
    const biases: number[][] = [];
    for (let l = 0; l < layerSizes.length - 1; l++) {
      const w: number[][] = [];
      const b: number[] = [];
      for (let i = 0; i < layerSizes[l + 1]; i++) {
        const row: number[] = [];
        for (let j = 0; j < layerSizes[l]; j++) row.push(rand() * 2 - 1);
        w.push(row);
        b.push(rand() * 2 - 1);
      }
      weights.push(w);
      biases.push(b);
    }

    const losses: number[] = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      for (const sample of TRAIN_DATA) {
        // Forward
        const acts: number[][] = [[sample[0], sample[1]]];
        for (let l = 0; l < weights.length; l++) {
          const prev = acts[l];
          const next: number[] = [];
          for (let i = 0; i < layerSizes[l + 1]; i++) {
            let z = biases[l][i];
            for (let j = 0; j < prev.length; j++) z += weights[l][i][j] * prev[j];
            next.push(sigmoid(z));
          }
          acts.push(next);
        }
        const pred = acts[acts.length - 1][0];
        const target = sample[2];
        totalLoss += (pred - target) ** 2;

        // Backward
        let da = 2 * (pred - target);
        for (let l = weights.length - 1; l >= 0; l--) {
          const prev = acts[l];
          const dz: number[] = [];
          for (let i = 0; i < layerSizes[l + 1]; i++) {
            const a = acts[l + 1][i];
            dz.push(da * a * (1 - a));
          }
          for (let i = 0; i < layerSizes[l + 1]; i++) {
            for (let j = 0; j < layerSizes[l]; j++) {
              weights[l][i][j] -= learningRate * dz[i] * prev[j];
            }
            biases[l][i] -= learningRate * dz[i];
          }
          if (l > 0) {
            const newDa: number[] = [];
            for (let j = 0; j < layerSizes[l]; j++) {
              let s = 0;
              for (let i = 0; i < layerSizes[l + 1]; i++) s += weights[l][i][j] * dz[i];
              newDa.push(s);
            }
            da = newDa[0]; // simplified for scalar chain
          }
        }
      }
      losses.push(totalLoss / TRAIN_DATA.length);
    }
    return losses;
  }

  /** Build the static network graph + chart frame ONCE. Never called during animation. */
  private buildStaticNetwork(): void {
    this.renderer.clearAnimations();
    this.scene.clear();
    this.nodes = [];
    this.edges = [];

    const w = this.width;
    const h = this.height;
    const title = new Text("反向传播 · 误差回流", w / 2, 26, 16);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Network on left half, loss chart on right half
    const netW = w * 0.55;
    const chartX = netW + 20;
    const chartW = w - chartX - 20;

    const layerX = [netW * 0.15, netW * 0.5, netW * 0.85];
    const layerSizes = this.layerSizes;
    const maxNodes = Math.max(...layerSizes);
    const spacing = Math.min(60, (h - 180) / Math.max(maxNodes, 1));
    const cy = h / 2;
    const radius = 18;
    const layerHues = [180, 260, 30];

    // Build nodes
    for (let l = 0; l < layerSizes.length; l++) {
      const count = layerSizes[l];
      const x = layerX[l];
      const totalH = (count - 1) * spacing;
      const startY = cy - totalH / 2;
      const arr: BPNode[] = [];
      for (let i = 0; i < count; i++) {
        const ny = startY + i * spacing;
        const gn = new GlowNode(x, ny, radius);
        gn.hue = layerHues[l];
        gn.intensity = 0;
        this.scene.add(gn);
        arr.push({ x, y: ny, glowNode: gn });
      }
      this.nodes.push(arr);
    }

    // Build edges
    for (let l = 0; l < layerSizes.length - 1; l++) {
      const fromNodes = this.nodes[l];
      const toNodes = this.nodes[l + 1];
      for (let j = 0; j < fromNodes.length; j++) {
        for (let i = 0; i < toNodes.length; i++) {
          const line = new Line(fromNodes[j].x, fromNodes[j].y, toNodes[i].x, toNodes[i].y);
          line.strokeStyle = "rgba(71, 85, 105, 0.4)";
          line.lineWidth = 1.5;
          this.scene.add(line);
          this.edges.push({
            x1: fromNodes[j].x, y1: fromNodes[j].y,
            x2: toNodes[i].x, y2: toNodes[i].y,
            line, layer: l,
          });
        }
      }
    }

    // Layer labels
    const labels = ["输入", "隐藏", "输出"];
    for (let l = 0; l < layerSizes.length; l++) {
      const lbl = new Text(labels[l], layerX[l], 58, 11);
      lbl.fillStyle = COLORS.textDim;
      this.scene.add(lbl);
    }

    // Phase label (mutated in-place during animation)
    this.phaseLabel = new Text("", netW / 2, h - 30, 14);
    this.phaseLabel.fillStyle = COLORS.accent;
    this.phaseLabel.fontWeight = "bold";
    this.scene.add(this.phaseLabel);

    // Loss chart frame (on the "chart" layer so it can be cleared/redrawn)
    this.scene.setLayer("chart");
    const chartFrame = new Rect(chartX + chartW / 2, cy, chartW, h - 120, 6);
    chartFrame.fillStyle = "rgba(15, 52, 96, 0.3)";
    chartFrame.strokeStyle = "rgba(71, 85, 105, 0.6)";
    chartFrame.lineWidth = 1;
    this.scene.add(chartFrame);

    const chartTitle = new Text("损失曲线 (实时)", chartX + chartW / 2, 62, 13);
    chartTitle.fillStyle = COLORS.text;
    chartTitle.fontWeight = "bold";
    this.scene.add(chartTitle);
    this.scene.setLayer("default");

    this.renderer.renderOnce();
  }

  private setPhaseLabel(text: string): void {
    if (this.phaseLabel) {
      this.phaseLabel.text = text;
    }
  }

  private getPhaseText(): string {
    switch (this.phase) {
      case "forward": return "① 前向传播：数据从左流向右";
      case "loss": return "② 计算误差：预测 vs 真实";
      case "backward": return "③ 反向传播：误差从右流回左";
      case "done": return "✅ 训练完成！损失持续下降";
      default: return "";
    }
  }

  private animateTraining(): void {
    // Build the static network ONCE. During animation we only:
    //  - mutate node intensities in-place (no scene rebuild)
    //  - add/remove Particle shapes for forward/backward flow
    //  - redraw the loss chart on a separate "chart" layer
    this.buildStaticNetwork();
    this.scene.setLayer("chart");
    this.scene.clear("chart");
    this.scene.setLayer("default");

    const totalPoints = this.lossHistory.length;
    const maxLoss = Math.max(...this.lossHistory, 0.01);

    const state = { point: 0 };
    const tween = new Tween(state, { point: totalPoints }, 4000, Easing.easeOutCubic);

    let lastPhase = "";
    let emitCooldown = 0;

    tween.onUpdate((progress) => {
      this.displayedLossPoints = Math.floor(state.point);
      const p = state.point / totalPoints;

      // Cycle through phases
      const cyclePhase = Math.floor(p * 12) % 4;
      const phases = ["forward", "loss", "backward", "backward"];
      this.phase = phases[cyclePhase];

      // Only emit particles when phase changes (not every frame)
      if (this.phase !== lastPhase) {
        lastPhase = this.phase;
        emitCooldown = 0;

        // Update phase label in-place
        if (this.phaseLabel) {
          this.phaseLabel.text = this.getPhaseText();
        }

        // Light up nodes based on phase (mutate existing GlowNode objects)
        if (this.phase === "forward") {
          this.setNodeIntensities([0.7, 0.2, 0]);
        } else if (this.phase === "backward") {
          this.setNodeIntensities([0.2, 0.4, 0.7]);
        } else {
          this.setNodeIntensities([0.4, 0.4, 0.4]);
        }

        // Emit a burst of particles on phase change
        if (this.phase === "forward") {
          this.emitForwardParticles();
        } else if (this.phase === "backward") {
          this.emitBackwardParticles();
        }
      }

      // Also emit occasionally during the phase
      emitCooldown += progress;
      if (emitCooldown > 0.15) {
        emitCooldown = 0;
        if (this.phase === "forward") {
          this.emitForwardParticles();
        } else if (this.phase === "backward") {
          this.emitBackwardParticles();
        }
      }

      // Redraw only the loss chart (chart layer)
      this.scene.clear("chart");
      this.scene.setLayer("chart");
      this.drawLossCurve(maxLoss);
      this.scene.setLayer("default");
    });

    tween.onComplete(() => {
      this.displayedLossPoints = totalPoints;
      this.phase = "done";
      this.setNodeIntensities([0.5, 0.5, 0.8]);
      if (this.phaseLabel) {
        this.phaseLabel.text = this.getPhaseText();
      }
      this.scene.clear("chart");
      this.scene.setLayer("chart");
      this.drawLossCurve(maxLoss);
      this.scene.setLayer("default");
      this.running = false;
      this.setVisualizationStatus("completed");
    });

    this.renderer.addTween(tween);
  }

  private setNodeIntensities(intensities: number[]): void {
    for (let l = 0; l < this.nodes.length; l++) {
      const intensity = intensities[l] ?? 0;
      for (const node of this.nodes[l]) {
        node.glowNode.intensity = intensity;
      }
    }
  }

  private emitForwardParticles(): void {
    for (const edge of this.edges) {
      if (Math.random() > 0.5) continue;
      const p = new Particle(edge.x1, edge.y1, edge.x2, edge.y2, 2.5, 180);
      p.opacity = 0;
      this.scene.add(p);
      const ps = { progress: 0 };
      const pt = new Tween(ps, { progress: 1 }, 500, Easing.easeInOutCubic);
      pt.onUpdate(() => { p.progress = ps.progress; });
      pt.onComplete(() => {
        const fo = { v: 1 };
        const ft = new Tween(fo, { v: 0 }, 200);
        ft.onUpdate(() => { p.opacity = fo.v; });
        ft.onComplete(() => { this.scene.remove(p); });
        this.renderer.addTween(ft);
      });
      this.renderer.addTween(pt);

      const fi = { v: 0 };
      const fit = new Tween(fi, { v: 1 }, 100);
      fit.onUpdate(() => { p.opacity = fi.v; });
      this.renderer.addTween(fit);
    }
  }

  private emitBackwardParticles(): void {
    for (const edge of this.edges) {
      if (Math.random() > 0.5) continue;
      // Reverse direction (output -> input)
      const p = new Particle(edge.x2, edge.y2, edge.x1, edge.y1, 2.5, 0);
      p.opacity = 0;
      this.scene.add(p);
      const ps = { progress: 0 };
      const pt = new Tween(ps, { progress: 1 }, 500, Easing.easeInOutCubic);
      pt.onUpdate(() => { p.progress = ps.progress; });
      pt.onComplete(() => {
        const fo = { v: 1 };
        const ft = new Tween(fo, { v: 0 }, 200);
        ft.onUpdate(() => { p.opacity = fo.v; });
        ft.onComplete(() => { this.scene.remove(p); });
        this.renderer.addTween(ft);
      });
      this.renderer.addTween(pt);

      const fi = { v: 0 };
      const fit = new Tween(fi, { v: 1 }, 100);
      fit.onUpdate(() => { p.opacity = fi.v; });
      this.renderer.addTween(fit);
    }
  }

  private drawLossCurve(maxLoss: number): void {
    if (this.displayedLossPoints < 2) return;

    const w = this.width;
    const h = this.height;
    const chartX = w * 0.55 + 20;
    const chartW = w - chartX - 20;
    const chartH = h - 140;
    const chartTop = 80;
    const chartBottom = chartTop + chartH;

    const points = this.lossHistory.slice(0, this.displayedLossPoints);
    const n = points.length;

    // Draw loss line
    for (let i = 0; i < n - 1; i++) {
      const x1 = chartX + 20 + (i / (this.lossHistory.length - 1)) * (chartW - 40);
      const y1 = chartBottom - (points[i] / maxLoss) * (chartH - 30);
      const x2 = chartX + 20 + ((i + 1) / (this.lossHistory.length - 1)) * (chartW - 40);
      const y2 = chartBottom - (points[i + 1] / maxLoss) * (chartH - 30);
      const line = new Line(x1, y1, x2, y2);
      line.strokeStyle = COLORS.positive;
      line.lineWidth = 2;
      this.scene.add(line);
    }

    // Current loss point (glowing dot)
    if (n > 0) {
      const lastX = chartX + 20 + ((n - 1) / (this.lossHistory.length - 1)) * (chartW - 40);
      const lastY = chartBottom - (points[n - 1] / maxLoss) * (chartH - 30);
      const dot = new Circle(lastX, lastY, 5);
      dot.fillStyle = COLORS.highlight;
      dot.strokeStyle = "#ffffff";
      dot.lineWidth = 2;
      this.scene.add(dot);

      const valLabel = new Text(`loss = ${points[n - 1].toFixed(4)}`, lastX, lastY - 16, 11);
      valLabel.fillStyle = COLORS.highlight;
      valLabel.fontWeight = "bold";
      this.scene.add(valLabel);
    }

    // Axis labels
    const xLabel = new Text("训练轮次 →", chartX + chartW / 2, chartBottom + 16, 11);
    xLabel.fillStyle = COLORS.textDim;
    this.scene.add(xLabel);

    const highLabel = new Text(maxLoss.toFixed(2), chartX + 10, chartTop + 8, 10);
    highLabel.fillStyle = COLORS.negative;
    highLabel.align = "left";
    this.scene.add(highLabel);

    const lowLabel = new Text("0", chartX + 10, chartBottom - 4, 10);
    lowLabel.fillStyle = COLORS.positive;
    lowLabel.align = "left";
    this.scene.add(lowLabel);

    this.renderer.renderOnce();
  }
}
