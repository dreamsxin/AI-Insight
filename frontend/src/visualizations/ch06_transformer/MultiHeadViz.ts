/** Multi-head attention explained as several observers reading the same sentence. */

import { StepSequenceVisualization } from "@/visualizations/StepSequenceVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Circle } from "@/canvas/shapes/Circle";
import { COLORS } from "@/utils/color";
import { Easing } from "@/canvas/animation/Easing";

const TOKENS = ["小猫", "追着", "毛线球", "开心地", "玩"];
const OBSERVERS = [
  { role: "谁在行动", clue: "小猫 ↔ 追着" },
  { role: "动作指向谁", clue: "追着 ↔ 毛线球" },
  { role: "语气怎么样", clue: "开心地 ↔ 玩" },
  { role: "前后位置", clue: "小猫 ↔ 玩" },
  { role: "事物关系", clue: "小猫 ↔ 毛线球" },
  { role: "动作方式", clue: "开心地 ↔ 追着" },
  { role: "句子主角", clue: "小猫" },
  { role: "最终动作", clue: "玩" },
];
const OBSERVER_COLORS = [COLORS.accent, COLORS.accent2, COLORS.accent3];

export class MultiHeadViz extends StepSequenceVisualization {
  protected get maxStep(): number {
    return 3;
  }

  protected get transitionDuration(): number {
    return 680;
  }

  onMount(): void {
    this.initializeStepSequence();
    super.resize();
    this.renderStepSequenceFrame();
  }

  onControlChange(key: string, _value: number): void {
    if (this.handleStepSequenceControl(key)) return;
    if (key === "heads") {
      this.initializeStepSequence();
      this.renderStepSequenceFrame();
    }
  }

  override resize(): void {
    super.resize();
    this.renderStepSequenceFrame();
  }

  protected renderStepSequenceFrame(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const step = Math.max(0, Math.min(this.maxStep, Math.floor(this.controls["step"] ?? 0)));
    const heads = Math.max(1, Math.min(8, Math.floor(this.controls["heads"] ?? 4)));
    const compact = w < 560;
    const movement = Easing.easeOutCubic(this.stepTransition.progress);

    this.addText("让多位观察员同时读一句话", w / 2, 26, 18, COLORS.text, true);
    this.addText("专业名称：多头注意力 Multi-Head Attention", w / 2, 50, 11, COLORS.textDim);

    const tokenGap = Math.min(86, (w - 42) / TOKENS.length);
    const tokenWidth = Math.max(44, tokenGap - 9);
    const tokenStart = w / 2 - tokenGap * (TOKENS.length - 1) / 2;
    TOKENS.forEach((token, index) => {
      const rect = new Rect(tokenStart + index * tokenGap, 84, tokenWidth, 38, 4);
      rect.fillStyle = COLORS.panel;
      rect.strokeStyle = step === 0 ? COLORS.highlight : COLORS.edge;
      rect.lineWidth = step === 0 ? 2 : 1;
      this.scene.add(rect);
      this.addText(token, rect.x, rect.y, compact ? 11 : 12, COLORS.text, step === 0);
    });

    const stageStart = this.scene.getShapes().length;
    const observerCenters: Array<{ x: number; y: number; color: string }> = [];
    if (step >= 1) {
      const columns = compact ? 2 : Math.min(4, heads);
      const rows = Math.ceil(heads / columns);
      const top = 122;
      const bottom = step >= 3 ? h - 98 : h - 34;
      const areaHeight = Math.max(190, bottom - top);
      const cellWidth = (w - 28) / columns;
      const cellHeight = areaHeight / rows;
      const cardWidth = Math.min(compact ? 150 : 158, cellWidth - 10);
      const cardHeight = Math.min(compact ? 52 : 62, cellHeight - 8);

      for (let index = 0; index < heads; index++) {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const finalX = 14 + cellWidth * column + cellWidth / 2;
        const finalY = top + cellHeight * row + cellHeight / 2;
        const sourceX = tokenStart + (index % TOKENS.length) * tokenGap;
        const x = step === 1 ? sourceX + (finalX - sourceX) * movement : finalX;
        const y = step === 1 ? 104 + (finalY - 104) * movement : finalY;
        const color = OBSERVER_COLORS[index % OBSERVER_COLORS.length];
        observerCenters.push({ x: finalX, y: finalY, color });
        const card = new Rect(x, y, cardWidth, cardHeight, 5);
        card.fillStyle = COLORS.panel;
        card.strokeStyle = color;
        card.lineWidth = step >= 2 ? 2 : 1;
        this.scene.add(card);
        this.addText(`观察员 ${index + 1} · ${OBSERVERS[index].role}`, x, y - (step >= 2 ? 11 : 0), compact ? 10 : 11, COLORS.text, true);
        if (step >= 2) {
          this.addText(`重点：${OBSERVERS[index].clue}`, x, y + 12, compact ? 9 : 10, color);
          const clueWidth = (cardWidth - 18) * (step === 2 ? movement : 1);
          const clueBar = new Rect(x - (cardWidth - 18) / 2 + clueWidth / 2, y + cardHeight / 2 - 5, clueWidth, 3, 1);
          clueBar.fillStyle = color;
          clueBar.strokeStyle = "transparent";
          this.scene.add(clueBar);
        }
      }
    }

    if (step >= 3) {
      const resultWidth = Math.min(480, w - 32);
      for (const observer of observerCenters) {
        const dot = new Circle(
          observer.x + (w / 2 - observer.x) * movement,
          observer.y + (h - 91 - observer.y) * movement,
          compact ? 3 : 4,
        );
        dot.fillStyle = observer.color;
        this.scene.add(dot);
      }
      const barWidth = resultWidth * movement;
      const bar = new Rect(w / 2, h - 63, barWidth, 52, 5);
      bar.fillStyle = "rgba(76, 195, 138, 0.10)";
      bar.strokeStyle = COLORS.positive;
      bar.lineWidth = 2;
      this.scene.add(bar);
      if (movement > 0.35) this.addText("合并大家看到的线索", w / 2, h - 72, 13, COLORS.positive, true);
      if (movement > 0.62) this.addText("谁做了什么、对象是谁、语气如何，都汇成一份完整理解", w / 2, h - 52, compact ? 10 : 11, COLORS.text);
    }

    const stepLabels = [
      "先给所有观察员同一句话",
      `派出 ${heads} 位观察员，各自负责一个角度`,
      "每个人圈出自己认为重要的关系",
      "最后把所有线索合在一起",
    ];
    this.addText(stepLabels[step], w / 2, h - 16, compact ? 10 : 12, COLORS.textDim);
    this.applyStepTransition(stageStart);
    this.renderer.renderOnce();
  }

  private addText(text: string, x: number, y: number, size: number, color: string, bold = false): void {
    const label = new Text(text, x, y, size);
    label.fillStyle = color;
    label.fontWeight = bold ? "bold" : "normal";
    this.scene.add(label);
  }
}
