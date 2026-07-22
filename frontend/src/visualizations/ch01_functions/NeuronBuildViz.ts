/** NeuronBuildViz - step-by-step construction of a neuron from y=f(wx+b).

Step 0: Simple function y = wx + b
Step 1: Multiple inputs y = w₁x₁ + w₂x₂ + b
Step 2: Add activation a = f(Σ wᵢxᵢ + b)
Step 3: Full neuron model with labeled components and concrete numbers

When the step changes, elements animate in (fade + slide from bottom via
easeOutBack). In step 3 the neuron is a GlowNode, concrete numbers
(x1=2, x2=3, x3=1, weights, bias) flow as particles from inputs to the
Σ circle, which pulses to show "summing is happening". The f() box
changes color when activation happens. Plain-language labels describe
each stage.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Line } from "@/canvas/shapes/Line";
import { Circle } from "@/canvas/shapes/Circle";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { GlowNode } from "@/canvas/shapes/GlowNode";
import { Particle } from "@/canvas/shapes/Particle";
import { COLORS } from "@/utils/color";
import { relu } from "@/utils/math";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";

export class NeuronBuildViz extends BaseVisualization {
  /** Entrance animation progress (0..1) for the current step. */
  private entrance = { val: 0 };
  /** Σ pulse progress (0..1) looping, drives scale of the sum circle. */
  private sumPulse = { val: 0 };
  /** Activation color progress (0..1) for the f() box. */
  private actGlow = { val: 0 };
  /** Particle flow progress (0..1) looping along input->sum lines. */
  private particleProgress = { val: 0 };

  onMount(): void {
    this.render();
    this.startStepEntrance();
    this.startSumPulse();
  }

  onControlChange(key: string, _value: number): void {
    if (key === "step") {
      this.actGlow.val = 0;
      // Clear all previous animations to prevent tween accumulation
      this.renderer.clearAnimations();
      this.render();
      this.startStepEntrance();
      this.startSumPulse();
      this.startParticleFlow();
    }
  }

  /** Current step index. */
  private get step(): number {
    return Math.floor(this.controls["step"] ?? 0);
  }

  /** Ease of entrance: combine fade and slide-from-bottom. */
  private get entranceEase(): number {
    return Easing.easeOutBack(this.entrance.val);
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;

    switch (this.step) {
      case 0: this.drawStep0(w, h); break;
      case 1: this.drawStep1(w, h); break;
      case 2: this.drawStep2(w, h); break;
      case 3: this.drawStep3(w, h); break;
    }

    // Step indicator
    const stepText = new Text(`步骤 ${this.step + 1} / 4`, w / 2, 24, 14);
    stepText.fillStyle = COLORS.textDim;
    this.scene.add(stepText);

    this.renderer.renderOnce();
  }

  private drawStep0(w: number, h: number): void {
    const cy = h / 2;
    const e = this.entranceEase;

    const xLabel = new Text("x", w * 0.15, cy + (1 - e) * 40, 20);
    xLabel.fillStyle = COLORS.accent;
    xLabel.fontWeight = "bold";
    xLabel.opacity = e;
    this.scene.add(xLabel);

    const box = new Rect(w * 0.4, cy + (1 - e) * 40, 120, 50, 8);
    box.fillStyle = COLORS.panel;
    box.strokeStyle = COLORS.accent2;
    box.lineWidth = 2;
    box.opacity = e;
    this.scene.add(box);

    const boxLabel = new Text("y = wx + b", w * 0.4, cy + (1 - e) * 40, 15);
    boxLabel.fillStyle = COLORS.accent2;
    boxLabel.fontFamily = "monospace";
    boxLabel.opacity = e;
    this.scene.add(boxLabel);

    const arrow1 = new Arrow(w * 0.18, cy, w * 0.33, cy);
    arrow1.strokeStyle = COLORS.accent;
    arrow1.lineWidth = 2;
    arrow1.opacity = e;
    this.scene.add(arrow1);

    const arrow2 = new Arrow(w * 0.47, cy, w * 0.62, cy);
    arrow2.strokeStyle = COLORS.accent;
    arrow2.lineWidth = 2;
    arrow2.opacity = e;
    this.scene.add(arrow2);

    const yLabel = new Text("y", w * 0.65, cy + (1 - e) * 40, 20);
    yLabel.fillStyle = COLORS.accent3;
    yLabel.fontWeight = "bold";
    yLabel.opacity = e;
    this.scene.add(yLabel);

    this.addDesc("最简单的线性函数：一个输入 x，通过权重 w 和偏置 b，得到输出 y", w, h);
  }

  private drawStep1(w: number, h: number): void {
    const cy = h / 2;
    const e = this.entranceEase;
    const inputs = [
      { label: "x₁", y: cy - 60 },
      { label: "x₂", y: cy },
      { label: "x₃", y: cy + 60 },
    ];

    for (const inp of inputs) {
      const label = new Text(inp.label, w * 0.15, inp.y + (1 - e) * 40, 18);
      label.fillStyle = COLORS.accent;
      label.fontWeight = "bold";
      label.opacity = e;
      this.scene.add(label);

      const arrow = new Arrow(w * 0.18, inp.y, w * 0.35, cy);
      arrow.strokeStyle = COLORS.accent;
      arrow.lineWidth = 1.5;
      arrow.opacity = e;
      this.scene.add(arrow);

      const midX = (w * 0.18 + w * 0.35) / 2;
      const midY = (inp.y + cy) / 2;
      const wLabel = new Text(`w${inp.label[1]}`, midX + 10, midY - 6, 11);
      wLabel.fillStyle = COLORS.textDim;
      wLabel.opacity = e;
      this.scene.add(wLabel);
    }

    const box = new Rect(w * 0.42, cy, 80, 50, 8);
    box.fillStyle = COLORS.panel;
    box.strokeStyle = COLORS.accent2;
    box.lineWidth = 2;
    box.opacity = e;
    this.scene.add(box);

    const sumLabel = new Text("Σ", w * 0.42, cy, 22);
    sumLabel.fillStyle = COLORS.accent2;
    sumLabel.fontWeight = "bold";
    sumLabel.opacity = e;
    this.scene.add(sumLabel);

    const arrow = new Arrow(w * 0.47, cy, w * 0.62, cy);
    arrow.strokeStyle = COLORS.accent;
    arrow.lineWidth = 2;
    arrow.opacity = e;
    this.scene.add(arrow);

    const outLabel = new Text("Σwᵢxᵢ", w * 0.7, cy - 15, 14);
    outLabel.fillStyle = COLORS.text;
    outLabel.fontFamily = "monospace";
    outLabel.opacity = e;
    this.scene.add(outLabel);

    const bLabel = new Text("+ b", w * 0.7, cy + 5, 14);
    bLabel.fillStyle = COLORS.accent3;
    bLabel.fontFamily = "monospace";
    bLabel.opacity = e;
    this.scene.add(bLabel);

    this.addDesc("多输入：每个输入乘以各自的权重，求和后加上偏置 b", w, h);
  }

  private drawStep2(w: number, h: number): void {
    const cy = h / 2;
    const e = this.entranceEase;
    const inputs = [
      { label: "x₁", y: cy - 60 },
      { label: "x₂", y: cy },
      { label: "x₃", y: cy + 60 },
    ];

    for (const inp of inputs) {
      const label = new Text(inp.label, w * 0.12, inp.y + (1 - e) * 40, 18);
      label.fillStyle = COLORS.accent;
      label.fontWeight = "bold";
      label.opacity = e;
      this.scene.add(label);

      const arrow = new Arrow(w * 0.15, inp.y, w * 0.3, cy);
      arrow.strokeStyle = COLORS.accent;
      arrow.lineWidth = 1.5;
      arrow.opacity = e;
      this.scene.add(arrow);
    }

    // Sum circle (pulsing)
    const pulseScale = 1 + Math.sin(this.sumPulse.val * Math.PI * 2) * 0.08;
    const sumCircle = new Circle(w * 0.35, cy, 22);
    sumCircle.fillStyle = COLORS.panel;
    sumCircle.strokeStyle = COLORS.accent2;
    sumCircle.lineWidth = 2;
    sumCircle.scale = pulseScale * e;
    sumCircle.opacity = e;
    this.scene.add(sumCircle);

    const sumLabel = new Text("Σ", w * 0.35, cy, 16);
    sumLabel.fillStyle = COLORS.accent2;
    sumLabel.fontWeight = "bold";
    sumLabel.opacity = e;
    this.scene.add(sumLabel);

    const arrow1 = new Arrow(w * 0.38, cy, w * 0.5, cy);
    arrow1.strokeStyle = COLORS.text;
    arrow1.lineWidth = 1.5;
    arrow1.opacity = e;
    this.scene.add(arrow1);

    const zLabel = new Text("z", w * 0.44, cy - 14, 13);
    zLabel.fillStyle = COLORS.textDim;
    zLabel.fontFamily = "monospace";
    zLabel.opacity = e;
    this.scene.add(zLabel);

    // Activation function box (changes color when activation happens)
    const actBox = new Rect(w * 0.55, cy, 70, 45, 8);
    const glow = this.actGlow.val;
    actBox.fillStyle = glow > 0.01
      ? `rgba(249, 115, 22, ${0.2 + glow * 0.3})`
      : COLORS.panel;
    actBox.strokeStyle = COLORS.accent3;
    actBox.lineWidth = 2 + glow * 2;
    actBox.opacity = e;
    this.scene.add(actBox);

    const actLabel = new Text("f(z)", w * 0.55, cy, 14);
    actLabel.fillStyle = COLORS.accent3;
    actLabel.fontFamily = "monospace";
    actLabel.opacity = e;
    this.scene.add(actLabel);

    const arrow2 = new Arrow(w * 0.59, cy, w * 0.72, cy);
    arrow2.strokeStyle = COLORS.accent3;
    arrow2.lineWidth = 2;
    arrow2.opacity = e;
    this.scene.add(arrow2);

    const outLabel = new Text("a", w * 0.76, cy, 20);
    outLabel.fillStyle = COLORS.accent;
    outLabel.fontWeight = "bold";
    outLabel.opacity = e;
    this.scene.add(outLabel);

    this.addDesc("加上激活函数 f：先求和得到 z，再通过 f(z) 得到输出 a", w, h);
  }

  private drawStep3(w: number, h: number): void {
    const cy = h / 2;
    const e = this.entranceEase;
    // Concrete numbers
    const xVals = [2, 3, 1];
    const wVals = [0.5, 0.8, 0.3];
    const bias = 0.1;
    const inputs = [
      { label: "x₁", val: xVals[0], w: wVals[0], y: cy - 70 },
      { label: "x₂", val: xVals[1], w: wVals[1], y: cy },
      { label: "x₃", val: xVals[2], w: wVals[2], y: cy + 70 },
    ];

    const neuronX = w * 0.5;
    // Neuron circle as GlowNode
    const neuron = new GlowNode(neuronX, cy, 35);
    neuron.hue = 260;
    neuron.intensity = 0.4 + e * 0.5;
    neuron.scale = e;
    neuron.glowScale = 2.2;
    this.scene.add(neuron);

    // Inner labels: Σ and f
    const sigmaLabel = new Text("Σ", neuronX - 12, cy - 6, 16);
    sigmaLabel.fillStyle = COLORS.accent2;
    sigmaLabel.fontWeight = "bold";
    sigmaLabel.opacity = e;
    this.scene.add(sigmaLabel);

    const fLabel = new Text("f", neuronX + 12, cy + 8, 14);
    fLabel.fillStyle = COLORS.accent3;
    fLabel.fontFamily = "monospace";
    fLabel.opacity = e;
    this.scene.add(fLabel);

    const divider = new Line(neuronX, cy - 20, neuronX, cy + 20);
    divider.strokeStyle = COLORS.textDim;
    divider.lineWidth = 1;
    divider.opacity = e;
    this.scene.add(divider);

    for (const inp of inputs) {
      // Input label with concrete value
      const label = new Text(`${inp.label}=${inp.val}`, w * 0.12, inp.y + (1 - e) * 40, 15);
      label.fillStyle = COLORS.accent;
      label.fontWeight = "bold";
      label.opacity = e;
      this.scene.add(label);

      // Connection line
      const line = new Line(w * 0.16, inp.y, neuronX - 30, cy);
      line.strokeStyle = COLORS.edge;
      line.lineWidth = 2;
      line.opacity = e;
      this.scene.add(line);

      // Weight label
      const midX = (w * 0.16 + neuronX - 30) / 2;
      const midY = (inp.y + cy) / 2;
      const wLabel = new Text(`w=${inp.w}`, midX, midY - 8, 11);
      wLabel.fillStyle = COLORS.highlight;
      wLabel.fontFamily = "monospace";
      wLabel.opacity = e;
      this.scene.add(wLabel);

      // Particle flowing along the connection (looping)
      const p = new Particle(w * 0.16, inp.y, neuronX - 30, cy, 3, 180);
      p.progress = this.particleProgress.val;
      p.opacity = e;
      this.scene.add(p);
    }

    // Bias arrow
    const biasArrow = new Arrow(neuronX, cy + 35 + 30, neuronX, cy + 36);
    biasArrow.strokeStyle = COLORS.accent3;
    biasArrow.lineWidth = 2;
    biasArrow.opacity = e;
    this.scene.add(biasArrow);

    const bLabel = new Text(`b=${bias}`, neuronX, cy + 35 + 42, 14);
    bLabel.fillStyle = COLORS.accent3;
    bLabel.fontWeight = "bold";
    bLabel.fontFamily = "monospace";
    bLabel.opacity = e;
    this.scene.add(bLabel);

    // Output with computed value
    const z = xVals[0] * wVals[0] + xVals[1] * wVals[1] + xVals[2] * wVals[2] + bias;
    const a = relu(z);
    const outArrow = new Arrow(neuronX + 35, cy, w * 0.75, cy);
    outArrow.strokeStyle = COLORS.accent;
    outArrow.lineWidth = 2.5;
    outArrow.opacity = e;
    this.scene.add(outArrow);

    const outLabel = new Text(`a=${a.toFixed(2)}`, w * 0.78, cy, 18);
    outLabel.fillStyle = COLORS.accent;
    outLabel.fontWeight = "bold";
    outLabel.fontFamily = "monospace";
    outLabel.opacity = e;
    this.scene.add(outLabel);

    // Plain-language stage labels
    const stageLabels = [
      { text: "输入(原料)", x: w * 0.12, y: cy + 110 },
      { text: "求和(加工)", x: neuronX, y: cy + 110 },
      { text: "激活(检验)", x: w * 0.62, y: cy + 110 },
      { text: "输出(产品)", x: w * 0.78, y: cy + 110 },
    ];
    for (const sl of stageLabels) {
      const t = new Text(sl.text, sl.x, sl.y + (1 - e) * 30, 12);
      t.fillStyle = COLORS.textDim;
      t.opacity = e;
      this.scene.add(t);
    }

    // Computation detail
    const detail = new Text(
      `z = ${wVals[0]}×${xVals[0]} + ${wVals[1]}×${xVals[1]} + ${wVals[2]}×${xVals[2]} + ${bias} = ${z.toFixed(2)}  →  a = ${a.toFixed(2)}`,
      w / 2, h - 50, 12,
    );
    detail.fillStyle = COLORS.text;
    detail.fontFamily = "monospace";
    detail.opacity = e;
    this.scene.add(detail);

    const formulaText = new Text("a = f( Σ wᵢxᵢ + b )", w / 2, h - 28, 16);
    formulaText.fillStyle = COLORS.accent;
    formulaText.fontFamily = "monospace";
    formulaText.fontWeight = "bold";
    formulaText.opacity = e;
    this.scene.add(formulaText);
  }

  private addDesc(text: string, w: number, h: number): void {
    const e = this.entranceEase;
    const desc = new Text(text, w / 2, h - 40, 14);
    desc.fillStyle = COLORS.text;
    desc.opacity = e;
    this.scene.add(desc);
  }

  /** Animate entrance (0 -> 1) then trigger activation glow in steps 2/3. */
  private startStepEntrance(): void {
    this.entrance.val = 0;
    const tween = new Tween(this.entrance, { val: 1 }, 500, Easing.easeOutBack);
    tween.onUpdate(() => {
      this.render();
    });
    tween.onComplete(() => {
      if (this.step === 2 || this.step === 3) {
        this.fireActivationGlow();
      }
    });
    this.renderer.addTween(tween);
  }

  /** After entrance, animate the f() box / neuron "activating". */
  private fireActivationGlow(): void {
    const tween = new Tween(this.actGlow, { val: 1 }, 350, Easing.easeOutCubic);
    tween.onUpdate(() => {
      this.render();
    });
    this.renderer.addTween(tween);
  }

  /** Looping Σ pulse: drives a sine-like scale oscillation. */
  private startSumPulse(): void {
    const tween = new Tween(this.sumPulse, { val: 1 }, 1200, Easing.linear);
    tween.onUpdate(() => {
      this.render();
    });
    tween.onComplete(() => {
      tween.reset();
      this.renderer.addTween(tween);
    });
    this.renderer.addTween(tween);
  }

  /** Looping particle flow along input->sum connections (step 3). */
  private startParticleFlow(): void {
    const tween = new Tween(this.particleProgress, { val: 1 }, 1500, Easing.linear);
    tween.onUpdate(() => {
      this.render();
    });
    tween.onComplete(() => {
      tween.reset();
      this.renderer.addTween(tween);
    });
    this.renderer.addTween(tween);
  }
}
