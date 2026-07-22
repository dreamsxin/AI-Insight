/** ForwardPassViz - data flowing through a neural network as glowing particles.

When the user clicks "run", particles flow along every connection from
input -> hidden -> output. Nodes light up (GlowNode) and emit a GlowPulse
ring when particles arrive. The process can be replayed.

Key design: the static network graph is built ONCE. During animation,
only particle/pulse shapes are added/removed and node intensities are
mutated in-place — the scene is never cleared mid-animation.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { GlowPulse } from "@/canvas/shapes/GlowPulse";
import { Particle } from "@/canvas/shapes/Particle";
import { Line } from "@/canvas/shapes/Line";
import { Text } from "@/canvas/shapes/Text";
import { COLORS } from "@/utils/color";
import { colormapHue, normalizeLayer } from "@/utils/colormap";
import { relu } from "@/utils/math";
import { nnForward } from "@/api/compute";
import type { LayerResult } from "@/types/api";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

const LAYERS = [2, 3, 1];
const INPUTS = [0.5, 0.8];
const ACTIVATION = "relu";

interface NodeInfo {
  x: number;
  y: number;
  glowNode: GlowNode;
  radius: number;
}

interface EdgeInfo {
  x1: number; y1: number;
  x2: number; y2: number;
  weight: number;
  fromLayer: number;
  fromIdx: number;
  toIdx: number;
}

function localForward(): LayerResult[] {
  const results: LayerResult[] = [];
  let prevA = INPUTS.slice();
  for (let l = 0; l < LAYERS.length; l++) {
    const n = LAYERS[l];
    if (l === 0) {
      results.push({ index: 0, neurons: n, z: INPUTS.slice(), a: INPUTS.slice(), weights: [], biases: [] });
      continue;
    }
    const inN = LAYERS[l - 1];
    const z: number[] = [];
    const a: number[] = [];
    const weights: number[][] = [];
    const biases: number[] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      let sum = 0;
      for (let j = 0; j < inN; j++) {
        const w = ((i + 1) * (j + 1) * 0.37) % 1.6 - 0.8;
        row.push(w);
        sum += w * prevA[j];
      }
      const b = i * 0.2 - 0.1;
      biases.push(b);
      sum += b;
      z.push(sum);
      a.push(relu(sum));
      weights.push(row);
    }
    results.push({ index: l, neurons: n, z, a, weights, biases });
    prevA = a;
  }
  return results;
}

export class ForwardPassViz extends BaseVisualization {
  private layers: LayerResult[] = [];
  private isRunning = false;
  private nodes: NodeInfo[][] = [];
  private edges: EdgeInfo[] = [];
  private statusText: Text | null = null;

  onMount(): void {
    this.layers = localForward();
    this.buildStaticGraph();
    this.setStatus("👉 点击「运行前向传播」观看数据流动");
    // Light up input nodes immediately
    this.lightInputNodes();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run") {
      void this.runForward();
    }
  }

  private async runForward(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setStatus("正在计算...");
    this.renderer.renderOnce();

    let layers: LayerResult[];
    try {
      const res = await nnForward({ layers: LAYERS, inputs: INPUTS, activation: ACTIVATION });
      layers = res.layers;
    } catch {
      layers = localForward();
    }

    this.layers = layers;
    this.animateFlow(layers);
  }

  /** Build the static network graph ONCE. Never called during animation. */
  private buildStaticGraph(): void {
    this.scene.clear();
    this.nodes = [];
    this.edges = [];

    const w = this.width;
    const h = this.height;

    const title = new Text("前向传播 · 数据流动", w / 2, 26, 17);
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    const layerX = [w * 0.2, w / 2, w * 0.8];
    const maxNodes = Math.max(...LAYERS);
    const spacing = Math.min(75, (h - 180) / Math.max(maxNodes, 1));
    const cy = h / 2;
    const radius = Math.min(24, spacing * 0.32);
    const layerHues = [180, 260, 30];
    const layerLabels = ["输入层", "隐藏层", "输出层"];

    for (let l = 0; l < LAYERS.length; l++) {
      const count = LAYERS[l];
      const x = layerX[l];
      const totalH = (count - 1) * spacing;
      const startY = cy - totalH / 2;

      const lbl = new Text(layerLabels[l], x, 58, 12);
      lbl.fillStyle = COLORS.textDim;
      this.scene.add(lbl);

      const arr: NodeInfo[] = [];
      for (let i = 0; i < count; i++) {
        const ny = startY + i * spacing;
        const gn = new GlowNode(x, ny, radius);
        gn.hue = layerHues[l];
        gn.intensity = 0;
        this.scene.add(gn);
        arr.push({ x, y: ny, glowNode: gn, radius });
      }
      this.nodes.push(arr);
    }

    // Build edges
    for (let l = 0; l < LAYERS.length - 1; l++) {
      const fromNodes = this.nodes[l];
      const toNodes = this.nodes[l + 1];
      const layerData = this.layers[l + 1];
      for (let j = 0; j < fromNodes.length; j++) {
        for (let i = 0; i < toNodes.length; i++) {
          const weight = layerData.weights[i]?.[j] ?? 0.5;
          const line = new Line(fromNodes[j].x, fromNodes[j].y, toNodes[i].x, toNodes[i].y);
          const wMag = Math.abs(weight);
          line.strokeStyle = weight >= 0
            ? `rgba(0, 217, 255, ${0.15 + wMag * 0.15})`
            : `rgba(239, 68, 68, ${0.15 + wMag * 0.15})`;
          line.lineWidth = 0.8 + wMag * 1.5;
          this.scene.add(line);
          this.edges.push({
            x1: fromNodes[j].x, y1: fromNodes[j].y,
            x2: toNodes[i].x, y2: toNodes[i].y,
            weight: wMag, fromLayer: l, fromIdx: j, toIdx: i,
          });
        }
      }
    }

    // Status text placeholder
    this.statusText = new Text("", w / 2, h - 28, 14);
    this.statusText.fillStyle = COLORS.accent;
    this.statusText.fontWeight = "bold";
    this.scene.add(this.statusText);

    this.renderer.renderOnce();
  }

  private setStatus(msg: string, color: string = COLORS.accent): void {
    if (this.statusText) {
      this.statusText.text = msg;
      this.statusText.fillStyle = color;
    }
  }

  private lightInputNodes(): void {
    if (this.layers.length === 0) return;
    const inputLayer = this.layers[0];
    for (let i = 0; i < this.nodes[0].length; i++) {
      const node = this.nodes[0][i];
      node.glowNode.intensity = 0.6;
      node.glowNode.label = inputLayer.a[i].toFixed(2);
    }
  }

  /** Reset all nodes to dim state, keeping input lit. */
  private resetNodes(): void {
    for (let l = 0; l < this.nodes.length; l++) {
      for (const node of this.nodes[l]) {
        node.glowNode.intensity = 0;
        node.glowNode.label = "";
      }
    }
    this.lightInputNodes();
  }

  /** Animate the forward pass: particles flow layer by layer. */
  private animateFlow(layers: LayerResult[]): void {
    // Clear any leftover tweens/particles from a previous run
    this.renderer.clearAnimations();
    this.removeParticles();

    this.resetNodes();
    this.setStatus("数据正在流动...", COLORS.highlight);

    // Phase timing constants
    const PARTICLE_DURATION = 600; // ms for particle to travel one edge
    const LAYER_GAP = 200;        // ms gap between layers
    let currentTime = 0;

    // Phase 0: ensure input nodes are lit (already done by resetNodes)
    currentTime += 300;

    // For each layer transition: emit particles -> wait for arrival -> light dest nodes + pulse
    for (let l = 0; l < LAYERS.length - 1; l++) {
      const emitTime = currentTime;
      const arriveTime = emitTime + PARTICLE_DURATION;

      // Emit particles for all edges in this layer transition
      for (const edge of this.edges) {
        if (edge.fromLayer !== l) continue;

        const fromNodeIntensity = this.nodes[l][edge.fromIdx].glowNode.intensity;
        const hue = colormapHue(Math.max(0.1, fromNodeIntensity));
        const p = new Particle(edge.x1, edge.y1, edge.x2, edge.y2, 3, hue);
        p.opacity = 0;
        p.progress = 0;
        this.scene.add(p);

        // Fade in (100ms)
        const finState = { val: 0 };
        const finTween = new Tween(finState, { val: 1 }, 100);
        finTween.onUpdate(() => { p.opacity = finState.val; });
        finTween.setDelay(emitTime);
        this.renderer.addTween(finTween);

        // Travel along edge (PARTICLE_DURATION ms)
        const travelState = { progress: 0 };
        const travelTween = new Tween(travelState, { progress: 1 }, PARTICLE_DURATION, Easing.easeInOutCubic);
        travelTween.setDelay(emitTime);
        travelTween.onUpdate(() => { p.progress = travelState.progress; });
        travelTween.onComplete(() => {
          // Fade out particle (150ms)
          const foutState = { val: 1 };
          const foutTween = new Tween(foutState, { val: 0 }, 150);
          foutTween.onUpdate(() => { p.opacity = foutState.val; });
          foutTween.onComplete(() => { this.scene.remove(p); });
          this.renderer.addTween(foutTween);
        });
        this.renderer.addTween(travelTween);
      }

      // Light up destination nodes at arrival time
      const destNodes = this.nodes[l + 1];
      const layerData = layers[l + 1];
      const normA = normalizeLayer(layerData.a);

      for (let i = 0; i < destNodes.length; i++) {
        const node = destNodes[i];
        const targetIntensity = 0.3 + normA[i] * 0.7;
        const hue = colormapHue(normA[i]);

        const lightState = { val: 0 };
        const lightTween = new Tween(lightState, { val: targetIntensity }, 400, Easing.easeOutCubic);
        lightTween.setDelay(arriveTime);
        lightTween.onUpdate(() => {
          node.glowNode.intensity = lightState.val;
          node.glowNode.hue = hue;
        });
        lightTween.onComplete(() => {
          node.glowNode.label = layerData.a[i].toFixed(2);

          // Spawn GlowPulse ring at the node
          const pulse = new GlowPulse(node.x, node.y, node.radius * 3, hue);
          pulse.progress = 0;
          this.scene.add(pulse);

          const pulseState = { val: 0 };
          const pulseTween = new Tween(pulseState, { val: 1 }, 600, Easing.easeOutCubic);
          pulseTween.onUpdate(() => { pulse.progress = pulseState.val; });
          pulseTween.onComplete(() => {
            pulse.visible = false;
            this.scene.remove(pulse);
          });
          this.renderer.addTween(pulseTween);
        });
        this.renderer.addTween(lightTween);
      }

      currentTime = arriveTime + 400 + LAYER_GAP;
    }

    // Final completion message
    const finalDelay = currentTime;
    const doneState = { val: 0 };
    const doneTween = new Tween(doneState, { val: 1 }, 100);
    doneTween.setDelay(finalDelay);
    doneTween.onComplete(() => {
      this.setStatus("✅ 前向传播完成！再次点击可重播", COLORS.positive);
      this.isRunning = false;
    });
    this.renderer.addTween(doneTween);
  }

  /** Remove any Particle and GlowPulse shapes from the scene. */
  private removeParticles(): void {
    const shapes = this.scene.getShapes();
    for (const s of shapes) {
      if (s instanceof Particle || s instanceof GlowPulse) {
        this.scene.remove(s);
      }
    }
  }
}
