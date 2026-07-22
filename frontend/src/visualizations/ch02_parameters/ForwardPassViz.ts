/** ForwardPassViz - configurable, replayable neural-network data flow. */

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { GlowPulse } from "@/canvas/shapes/GlowPulse";
import { Particle } from "@/canvas/shapes/Particle";
import { Line } from "@/canvas/shapes/Line";
import { Text } from "@/canvas/shapes/Text";
import { COLORS } from "@/utils/color";
import { colormapHue, normalizeLayer } from "@/utils/colormap";
import { relu, sigmoid, step, tanh } from "@/utils/math";
import { nnForward } from "@/api/compute";
import type { LayerResult } from "@/types/api";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

const INPUTS = [0.5, 0.8];
const ACTIVATIONS = ["relu", "sigmoid", "tanh", "step"] as const;
type ActivationName = (typeof ACTIVATIONS)[number];

interface NodeInfo {
  x: number;
  y: number;
  glowNode: GlowNode;
  radius: number;
}

interface EdgeInfo {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  weight: number;
  fromLayer: number;
  fromIdx: number;
  toIdx: number;
}

function activate(name: ActivationName, value: number): number {
  if (name === "sigmoid") return sigmoid(value);
  if (name === "tanh") return tanh(value);
  if (name === "step") return step(value);
  return relu(value);
}

function localForward(
  layerSizes: number[],
  inputs: number[],
  activation: ActivationName,
): LayerResult[] {
  const results: LayerResult[] = [
    {
      index: 0,
      neurons: layerSizes[0],
      z: inputs.slice(),
      a: inputs.slice(),
      weights: [],
      biases: [],
    },
  ];

  let previous = inputs.slice();
  for (let layer = 1; layer < layerSizes.length; layer++) {
    const neuronCount = layerSizes[layer];
    const weights: number[][] = [];
    const biases: number[] = [];
    const z: number[] = [];
    const a: number[] = [];

    for (let i = 0; i < neuronCount; i++) {
      const row: number[] = [];
      let sum = 0;
      for (let j = 0; j < previous.length; j++) {
        const weight = (((layer + 1) * (i + 1) * (j + 2) * 0.37) % 1.6) - 0.8;
        row.push(weight);
        sum += weight * previous[j];
      }
      const bias = (i - (neuronCount - 1) / 2) * 0.14;
      sum += bias;
      weights.push(row);
      biases.push(bias);
      z.push(sum);
      a.push(activate(activation, sum));
    }

    results.push({ index: layer, neurons: neuronCount, z, a, weights, biases });
    previous = a;
  }

  return results;
}

export class ForwardPassViz extends BaseVisualization {
  private layers: LayerResult[] = [];
  private isRunning = false;
  private nodes: NodeInfo[][] = [];
  private edges: EdgeInfo[] = [];
  private statusText: Text | null = null;
  private runGeneration = 0;

  onMount(): void {
    this.configureNetwork("设置参数后，点击「运行前向传播」");
  }

  onControlChange(key: string, _value: number): void {
    if (key === "run") {
      void this.runForward();
      return;
    }

    if (key === "hidden_layers" || key === "hidden" || key === "activation") {
      this.configureNetwork("网络结构已更新，可以开始运行");
    }
  }

  onUnmount(): void {
    this.runGeneration++;
    this.isRunning = false;
  }

  private get layerSizes(): number[] {
    const hiddenLayers = Math.max(1, Math.floor(this.controls["hidden_layers"] ?? 1));
    const hiddenSize = Math.max(2, Math.floor(this.controls["hidden"] ?? 3));
    return [INPUTS.length, ...Array.from({ length: hiddenLayers }, () => hiddenSize), 1];
  }

  private get activationName(): ActivationName {
    const index = Math.max(0, Math.min(ACTIVATIONS.length - 1, Math.floor(this.controls["activation"] ?? 0)));
    return ACTIVATIONS[index];
  }

  private configureNetwork(status: string): void {
    this.runGeneration++;
    this.isRunning = false;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("idle");
    this.layers = localForward(this.layerSizes, INPUTS, this.activationName);
    this.buildStaticGraph();
    this.setStatus(status);
    this.lightInputNodes();
    this.renderer.renderOnce();
  }

  private async runForward(): Promise<void> {
    if (this.isRunning) {
      this.setStatus("动画正在运行，请等待本轮完成", COLORS.highlight);
      return;
    }

    const generation = ++this.runGeneration;
    const sizes = this.layerSizes;
    const activation = this.activationName;
    this.isRunning = true;
    this.setVisualizationStatus("running");
    this.setStatus("正在计算网络各层输出...");
    this.renderer.renderOnce();

    let layers: LayerResult[];
    try {
      const response = await nnForward({ layers: sizes, inputs: INPUTS, activation });
      layers = this.withInputLayer(response.layers, sizes);
    } catch {
      layers = localForward(sizes, INPUTS, activation);
    }

    if (generation !== this.runGeneration) return;

    this.layers = layers;
    this.renderer.clearAnimations();
    this.buildStaticGraph();
    this.animateFlow(layers);
  }

  private withInputLayer(computedLayers: LayerResult[], sizes: number[]): LayerResult[] {
    if (computedLayers.length !== sizes.length - 1) {
      return localForward(sizes, INPUTS, this.activationName);
    }

    const inputLayer: LayerResult = {
      index: 0,
      neurons: sizes[0],
      z: INPUTS.slice(),
      a: INPUTS.slice(),
      weights: [],
      biases: [],
    };

    return [
      inputLayer,
      ...computedLayers.map((layer, index) => ({
        ...layer,
        index: index + 1,
        neurons: sizes[index + 1],
      })),
    ];
  }

  private buildStaticGraph(): void {
    this.scene.clear();
    this.nodes = [];
    this.edges = [];

    const w = this.width;
    const h = this.height;
    const sizes = this.layerSizes;

    const title = new Text(
      w < 420
        ? `[${sizes.join("-")}] · ${this.activationName.toUpperCase()}`
        : `前向传播  [${sizes.join(" - ")}]  ·  ${this.activationName.toUpperCase()}`,
      w / 2,
      26,
      w < 420 ? 14 : 16,
    );
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    const marginX = Math.max(64, w * 0.11);
    const usableW = Math.max(1, w - marginX * 2);
    const layerX = sizes.map((_, index) =>
      marginX + (index / Math.max(1, sizes.length - 1)) * usableW,
    );
    const horizontalGap = usableW / Math.max(1, sizes.length - 1);
    const maxNodes = Math.max(...sizes);
    const spacing = Math.min(62, Math.max(34, (h - 190) / Math.max(maxNodes, 1)));
    const cy = h / 2 + 12;
    const radius = Math.max(9, Math.min(20, spacing * 0.3, horizontalGap * 0.13));

    for (let layer = 0; layer < sizes.length; layer++) {
      const count = sizes[layer];
      const x = layerX[layer];
      const startY = cy - ((count - 1) * spacing) / 2;
      const label = layer === 0
        ? "输入"
        : layer === sizes.length - 1
          ? "输出"
          : `隐藏 ${layer}`;

      const layerLabel = new Text(`${label} [${count}]`, x, 58, 11);
      layerLabel.fillStyle = COLORS.textDim;
      this.scene.add(layerLabel);

      const nodeLayer: NodeInfo[] = [];
      for (let index = 0; index < count; index++) {
        const y = startY + index * spacing;
        const node = new GlowNode(x, y, radius);
        node.hue = layer === 0 ? 180 : layer === sizes.length - 1 ? 35 : 220 + layer * 20;
        node.intensity = 0;
        node.labelSize = Math.max(9, Math.min(11, radius * 0.8));
        this.scene.add(node);
        nodeLayer.push({ x, y, glowNode: node, radius });
      }
      this.nodes.push(nodeLayer);
    }

    for (let layer = 0; layer < sizes.length - 1; layer++) {
      const fromNodes = this.nodes[layer];
      const toNodes = this.nodes[layer + 1];
      const layerData = this.layers[layer + 1];
      for (let fromIndex = 0; fromIndex < fromNodes.length; fromIndex++) {
        for (let toIndex = 0; toIndex < toNodes.length; toIndex++) {
          const weight = layerData?.weights[toIndex]?.[fromIndex] ?? 0;
          const magnitude = Math.min(1, Math.abs(weight));
          const line = new Line(
            fromNodes[fromIndex].x,
            fromNodes[fromIndex].y,
            toNodes[toIndex].x,
            toNodes[toIndex].y,
          );
          line.strokeStyle = weight >= 0
            ? `rgba(0, 217, 255, ${0.12 + magnitude * 0.18})`
            : `rgba(239, 68, 68, ${0.12 + magnitude * 0.18})`;
          line.lineWidth = 0.7 + magnitude * 1.4;
          this.scene.add(line);
          this.edges.push({
            x1: fromNodes[fromIndex].x,
            y1: fromNodes[fromIndex].y,
            x2: toNodes[toIndex].x,
            y2: toNodes[toIndex].y,
            weight: magnitude,
            fromLayer: layer,
            fromIdx: fromIndex,
            toIdx: toIndex,
          });
        }
      }
    }

    this.statusText = new Text("", w / 2, h - 26, 13);
    this.statusText.fillStyle = COLORS.accent;
    this.statusText.fontWeight = "bold";
    this.scene.add(this.statusText);
    this.lightInputNodes();
    this.renderer.renderOnce();
  }

  private setStatus(message: string, color: string = COLORS.accent): void {
    if (!this.statusText) return;
    this.statusText.text = message;
    this.statusText.fillStyle = color;
  }

  private lightInputNodes(): void {
    const inputLayer = this.layers[0];
    if (!inputLayer || !this.nodes[0]) return;
    for (let index = 0; index < this.nodes[0].length; index++) {
      const node = this.nodes[0][index];
      node.glowNode.intensity = 0.65;
      node.glowNode.label = inputLayer.a[index]?.toFixed(2) ?? "0";
    }
  }

  private resetNodes(): void {
    for (const layer of this.nodes) {
      for (const node of layer) {
        node.glowNode.intensity = 0;
        node.glowNode.label = "";
      }
    }
    this.lightInputNodes();
  }

  private animateFlow(layers: LayerResult[]): void {
    this.renderer.clearAnimations();
    this.removeParticles();
    this.resetNodes();
    this.setStatus("数据正在逐层流动...", COLORS.highlight);

    const particleDuration = 560;
    const layerGap = 180;
    let currentTime = 180;

    for (let layer = 0; layer < this.nodes.length - 1; layer++) {
      const emitTime = currentTime;
      const arriveTime = emitTime + particleDuration;

      for (const edge of this.edges) {
        if (edge.fromLayer !== layer) continue;

        const sourceIntensity = this.nodes[layer][edge.fromIdx].glowNode.intensity;
        const particle = new Particle(
          edge.x1,
          edge.y1,
          edge.x2,
          edge.y2,
          2.5 + edge.weight,
          colormapHue(Math.max(0.15, sourceIntensity)),
        );
        particle.opacity = 0;
        particle.progress = 0;
        this.scene.add(particle);

        const fadeIn = { value: 0 };
        const fadeInTween = new Tween(fadeIn, { value: 1 }, 100).setDelay(emitTime);
        fadeInTween.onUpdate(() => { particle.opacity = fadeIn.value; });
        this.renderer.addTween(fadeInTween);

        const travel = { progress: 0 };
        const travelTween = new Tween(travel, { progress: 1 }, particleDuration, Easing.easeInOutCubic)
          .setDelay(emitTime);
        travelTween.onUpdate(() => { particle.progress = travel.progress; });
        travelTween.onComplete(() => {
          const fadeOut = { value: 1 };
          const fadeOutTween = new Tween(fadeOut, { value: 0 }, 140);
          fadeOutTween.onUpdate(() => { particle.opacity = fadeOut.value; });
          fadeOutTween.onComplete(() => { this.scene.remove(particle); });
          this.renderer.addTween(fadeOutTween);
        });
        this.renderer.addTween(travelTween);
      }

      const layerData = layers[layer + 1];
      const normalized = normalizeLayer(layerData?.a ?? []);
      for (let index = 0; index < this.nodes[layer + 1].length; index++) {
        const node = this.nodes[layer + 1][index];
        const intensity = 0.35 + (normalized[index] ?? 0.5) * 0.65;
        const hue = colormapHue(normalized[index] ?? 0.5);
        const light = { value: 0 };
        const lightTween = new Tween(light, { value: intensity }, 360, Easing.easeOutCubic)
          .setDelay(arriveTime);
        lightTween.onUpdate(() => {
          node.glowNode.intensity = light.value;
          node.glowNode.hue = hue;
        });
        lightTween.onComplete(() => {
          node.glowNode.label = layerData?.a[index]?.toFixed(2) ?? "0";
          const pulse = new GlowPulse(node.x, node.y, node.radius * 3, hue);
          this.scene.add(pulse);
          const pulseState = { value: 0 };
          const pulseTween = new Tween(pulseState, { value: 1 }, 560, Easing.easeOutCubic);
          pulseTween.onUpdate(() => { pulse.progress = pulseState.value; });
          pulseTween.onComplete(() => { this.scene.remove(pulse); });
          this.renderer.addTween(pulseTween);
        });
        this.renderer.addTween(lightTween);
      }

      currentTime = arriveTime + 360 + layerGap;
    }

    const done = { value: 0 };
    const doneTween = new Tween(done, { value: 1 }, 80).setDelay(currentTime);
    doneTween.onComplete(() => {
      this.setStatus("前向传播完成，点击按钮可再次运行", COLORS.positive);
      this.isRunning = false;
      this.setVisualizationStatus("completed");
    });
    this.renderer.addTween(doneTween);
  }

  private removeParticles(): void {
    for (const shape of this.scene.getShapes()) {
      if (shape instanceof Particle || shape instanceof GlowPulse) {
        this.scene.remove(shape);
      }
    }
  }
}
