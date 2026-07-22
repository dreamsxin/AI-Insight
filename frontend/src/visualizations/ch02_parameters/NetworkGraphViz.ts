/** NetworkGraphViz - visualize a 3-layer neural network [2, hidden, 1].

Users slide "hidden" (1-8) to change the hidden layer size and watch the
network restructure. Connections breathe (subtle opacity oscillation) to
feel alive, new nodes POP IN with easeOutBack, neurons are GlowNodes
colored by a pseudo-activation value via colormap, and small networks
show weight values on each connection. The parameter count is shown
prominently.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { COLORS } from "@/utils/color";
import { colormap, colormapHue } from "@/utils/colormap";
import { mulberry32 } from "@/utils/math";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

interface NodePos {
  x: number;
  y: number;
}

interface ConnectionLine {
  line: Line;
  baseAlpha: number;
}

export class NetworkGraphViz extends BaseVisualization {
  private weights: number[][][] = [];
  private biases: number[][] = [];
  /** Live breathing factor (0..1) applied to connection opacities. */
  private breath = { val: 0 };
  /** Lines currently on screen, updated each breath frame. */
  private connectionLines: ConnectionLine[] = [];
  /** Nodes currently on screen, for pop-in animation. */
  private activeNodes: { node: GlowNode; pop: { val: number } }[] = [];
  private breathDirection = 1;

  onMount(): void {
    this.generateParameters();
    this.render(true);
    this.startBreathing();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "hidden" || key === "hidden_layers") {
      // Clear previous pop-in tweens to prevent accumulation
      this.renderer.clearAnimations();
      this.generateParameters();
      this.render(true);
      // Restart the breathing animation
      this.startBreathing();
    }
  }

  /** Build [input, ...hidden layers, output]. */
  private get layerSizes(): number[] {
    const hiddenLayers = Math.max(1, Math.floor(this.controls["hidden_layers"] ?? 1));
    const hiddenSize = Math.max(1, Math.floor(this.controls["hidden"] ?? 3));
    return [2, ...Array.from({ length: hiddenLayers }, () => hiddenSize), 1];
  }

  /** Generate weights/biases with a seeded RNG so visuals stay stable per layout. */
  private generateParameters(): void {
    const sizes = this.layerSizes;
    const rng = mulberry32(1337);
    this.weights = [];
    this.biases = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const rows = sizes[l + 1];
      const cols = sizes[l];
      const w: number[][] = [];
      for (let i = 0; i < rows; i++) {
        const row: number[] = [];
        for (let j = 0; j < cols; j++) {
          // weight in [-1, 1]
          row.push(rng() * 2 - 1);
        }
        w.push(row);
      }
      this.weights.push(w);
      this.biases.push(Array.from({ length: rows }, () => rng() * 2 - 1));
    }
  }

  /** Compute node positions for each layer, vertically centered. */
  private computePositions(
    layerX: number[],
    sizes: number[],
    cy: number,
    spacing: number,
  ): NodePos[][] {
    return sizes.map((count, l) => {
      const x = layerX[l];
      const totalH = (count - 1) * spacing;
      const startY = cy - totalH / 2;
      return Array.from({ length: count }, (_, i) => ({
        x,
        y: startY + i * spacing,
      }));
    });
  }

  /** A stable pseudo-activation per node, so colormap coloring is consistent. */
  private pseudoActivation(layer: number, idx: number): number {
    const rng = mulberry32(700 + layer * 100 + idx * 13);
    return rng();
  }

  /** Continuous breathing animation: line opacity oscillates 0.2 <-> 0.4. */
  private startBreathing(): void {
    const target = this.breathDirection > 0 ? 1 : 0;
    const tween = new Tween(this.breath, { val: target }, 1500, Easing.linear);
    tween.onUpdate(() => {
      const opacity = 0.2 + this.breath.val * 0.2;
      for (const c of this.connectionLines) {
        c.line.opacity = opacity;
      }
      this.renderer.renderOnce();
    });
    tween.onComplete(() => {
      this.breathDirection *= -1;
      this.startBreathing();
    });
    this.renderer.addTween(tween);
  }

  private render(animatePopIn: boolean = false): void {
    this.scene.clear();
    this.connectionLines = [];
    this.activeNodes = [];
    const w = this.width;
    const h = this.height;
    const sizes = this.layerSizes;

    // Title
    const title = new Text(
      w < 420 ? `[${sizes.join("-")}]` : "可配置神经网络结构",
      w / 2,
      28,
      w < 420 ? 15 : 18,
    );
    title.fillStyle = COLORS.text;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Spread any number of layers evenly from input to output.
    const marginX = Math.max(70, w * 0.12);
    const usableW = Math.max(1, w - marginX * 2);
    const layerX = sizes.map((_, index) =>
      marginX + (index / Math.max(1, sizes.length - 1)) * usableW,
    );

    // Vertical spacing depends on the largest layer
    const maxNodes = Math.max(...sizes);
    const availableH = h - 120;
    const spacing = Math.min(70, availableH / Math.max(maxNodes, 1));
    const cy = h / 2 + 10;
    const positions = this.computePositions(layerX, sizes, cy, spacing);
    const radius = Math.min(22, spacing * 0.32);

    // Layer labels
    for (let l = 0; l < sizes.length; l++) {
      const label = l === 0
        ? "输入层"
        : l === sizes.length - 1
          ? "输出层"
          : `隐藏层 ${l}`;
      const lbl = new Text(`${label}  [${sizes[l]}]`, layerX[l], 64, 13);
      lbl.fillStyle = COLORS.textDim;
      this.scene.add(lbl);
    }

    // Draw connections (weights) colored by sign, with weight value labels
    const showWeights = sizes.length <= 4 && sizes.slice(1, -1).every((size) => size <= 4);
    for (let l = 0; l < sizes.length - 1; l++) {
      const fromLayer = positions[l];
      const toLayer = positions[l + 1];
      const wMat = this.weights[l];
      for (let i = 0; i < toLayer.length; i++) {
        for (let j = 0; j < fromLayer.length; j++) {
          const from = fromLayer[j];
          const to = toLayer[i];
          const weight = wMat[i][j];
          const line = new Line(from.x, from.y, to.x, to.y);
          const mag = Math.min(1, Math.abs(weight));
          // Full-opacity color so the breathing opacity (0.2..0.4) is the
          // sole alpha source; magnitude reads through lineWidth.
          line.strokeStyle = weight >= 0 ? COLORS.accent : COLORS.negative;
          line.lineWidth = 1 + mag * 2.5;
          // initial breathing opacity (mid of the 0.2..0.4 modulation)
          line.opacity = 0.3;
          this.scene.add(line);
          this.connectionLines.push({ line, baseAlpha: 1 });

          // Weight value label on the connection
          if (showWeights) {
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const wt = new Text(weight.toFixed(2), mx, my - 6, 9);
            wt.fillStyle = weight >= 0 ? COLORS.accent : COLORS.negative;
            wt.fontFamily = "monospace";
            this.scene.add(wt);
          }
        }
      }
    }

    // Draw nodes as GlowNodes, colored by pseudo-activation via colormap
    for (let l = 0; l < sizes.length; l++) {
      for (let i = 0; i < positions[l].length; i++) {
        const p = positions[l][i];
        const act = this.pseudoActivation(l, i);
        const gn = new GlowNode(p.x, p.y, radius);
        gn.hue = colormapHue(act);
        gn.intensity = 0.35 + act * 0.5;
        gn.glowScale = 2.2;

        // Node label (input/output show x/y, hidden shows index)
        let label: string;
        if (l === 0) label = `x${i + 1}`;
        else if (l === sizes.length - 1) label = "y";
        else label = `h${l}.${i + 1}`;
        gn.label = label;
        gn.labelSize = 11;

        // Pop-in animation: scale 0 -> 1 with easeOutBack
        const pop = { val: 0 };
        const popNode = { node: gn, pop };
        this.activeNodes.push(popNode);
        gn.scale = 0;

        this.scene.add(gn);

        if (animatePopIn) {
          const tween = new Tween(pop, { val: 1 }, 450, Easing.easeOutBack);
          tween.onUpdate(() => {
            gn.scale = pop.val;
            this.renderer.renderOnce();
          });
          this.renderer.addTween(tween);
        } else {
          gn.scale = 1;
        }
      }
    }

    // Parameter count - made more visual with a panel + big number
    const weightCount = this.weights.reduce(
      (sum, mat) => sum + mat.reduce((s, row) => s + row.length, 0),
      0,
    );
    const biasCount = this.biases.reduce((s, b) => s + b.length, 0);
    const total = weightCount + biasCount;

    const paramLabel = new Text("总参数量", w / 2, h - 56, 12);
    paramLabel.fillStyle = COLORS.textDim;
    this.scene.add(paramLabel);

    const paramText = new Text(`${total}`, w / 2, h - 36, 26);
    paramText.fillStyle = colormap(Math.min(1, total / 30));
    paramText.fontWeight = "bold";
    paramText.fontFamily = "monospace";
    this.scene.add(paramText);

    const breakdown = new Text(
      `${weightCount} 权重 + ${biasCount} 偏置`,
      w / 2,
      h - 16,
      11,
    );
    breakdown.fillStyle = COLORS.textDim;
    this.scene.add(breakdown);

    // Legend for weight colors
    this.drawLegend(w, h);

    this.renderer.renderOnce();
  }

  private drawLegend(w: number, h: number): void {
    const lx = 20;
    const ly = h - 24;
    const posLine = new Line(lx, ly, lx + 24, ly);
    posLine.strokeStyle = `rgba(0, 217, 255, 0.7)`;
    posLine.lineWidth = 2;
    this.scene.add(posLine);
    const posLabel = new Text("权重 > 0", lx + 30, ly, 11);
    posLabel.fillStyle = COLORS.accent;
    posLabel.align = "left";
    this.scene.add(posLabel);

    const negLine = new Line(lx + 110, ly, lx + 134, ly);
    negLine.strokeStyle = `rgba(239, 68, 68, 0.7)`;
    negLine.lineWidth = 2;
    this.scene.add(negLine);
    const negLabel = new Text("权重 < 0", lx + 140, ly, 11);
    negLabel.fillStyle = COLORS.negative;
    negLabel.align = "left";
    this.scene.add(negLabel);
  }
}
