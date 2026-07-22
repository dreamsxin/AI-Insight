/** TokenizerViz - shows text being split into tokens.

The input text is drawn as a long candy/cake bar. A "knife" line comes down to
CUT the bar into token pieces; each piece then BOUNCES into position
(easeOutBounce) with a different color. A "text" select lets the user pick one
of three sample sentences. The token count and a short BPE note are displayed
at the bottom.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Rect } from "@/canvas/shapes/Rect";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Line } from "@/canvas/shapes/Line";
import { Tween } from "@/canvas/animation/Tween";
import { Easing } from "@/canvas/animation/Easing";
import { COLORS } from "@/utils/color";

/** A token with its text label and the character index where it starts. */
interface TokenDef {
  text: string;
  start: number;
}

interface TextSample {
  source: string;
  tokens: TokenDef[];
}

/** Predefined tokenization (hardcoded splits, not from the API). */
const TEXT_SAMPLES: TextSample[] = [
  {
    source: "我爱人工智能",
    tokens: [
      { text: "我", start: 0 },
      { text: "爱", start: 1 },
      { text: "人工", start: 2 },
      { text: "智能", start: 4 },
    ],
  },
  {
    source: "Transformer is powerful",
    tokens: [
      { text: "Transform", start: 0 },
      { text: "er", start: 9 },
      { text: " is", start: 11 },
      { text: " power", start: 14 },
      { text: "ful", start: 20 },
    ],
  },
  {
    source: "今天天气真好",
    tokens: [
      { text: "今天", start: 0 },
      { text: "天气", start: 2 },
      { text: "真", start: 4 },
      { text: "好", start: 5 },
    ],
  },
];

/** Color palette cycled across token boxes. */
const TOKEN_PALETTE: string[] = [
  COLORS.accent,
  COLORS.accent2,
  COLORS.accent3,
  COLORS.positive,
  COLORS.highlight,
  "#ec4899",
];

const KNIFE_MS = 320;
const BOUNCE_MS = 600;

export class TokenizerViz extends BaseVisualization {
  /** Knife progress: 0 = up high, 1 = cut into the bar. */
  private knife = { progress: 0 };
  /** Per-token bounce state: scale 0 -> 1 (eased by easeOutBounce). */
  private tokenScales: number[] = [];
  private cutGen = 0;

  onMount(): void {
    this.playCutAnimation();
  }

  onControlChange(_key: string, _value: number): void {
    this.playCutAnimation();
  }

  onUnmount(): void {
    this.renderer.clearAnimations();
  }

  private get sampleIndex(): number {
    const v = Math.floor(this.controls["text"] ?? 0);
    return Math.max(0, Math.min(TEXT_SAMPLES.length - 1, v));
  }

  /** Play the knife-cut + bounce animation for the current sample. */
  private playCutAnimation(): void {
    const gen = ++this.cutGen;
    this.renderer.clearAnimations();
    this.setVisualizationStatus("running");
    const sample = TEXT_SAMPLES[this.sampleIndex];
    this.tokenScales = sample.tokens.map(() => 0);
    this.knife.progress = 0;
    this.render();

    // Knife comes down.
    const knifeTw = new Tween(this.knife, { progress: 1 }, KNIFE_MS, Easing.easeInCubic);
    knifeTw.onUpdate(() => this.render());
    knifeTw.onComplete(() => {
      if (gen !== this.cutGen) return;
      this.render();
      // Stagger the bounce-in of each token piece.
      sample.tokens.forEach((_, i) => {
        const scaleState = { v: 0 };
        const bounce = new Tween(scaleState, { v: 1 }, BOUNCE_MS, Easing.easeOutBounce);
        bounce.setDelay(i * 120);
        bounce.onUpdate(() => {
          this.tokenScales[i] = scaleState.v;
          this.render();
        });
        bounce.onComplete(() => {
          if (gen !== this.cutGen) return;
          this.tokenScales[i] = 1;
          if (i === sample.tokens.length - 1) {
            this.setVisualizationStatus("completed");
          }
          this.render();
        });
        this.renderer.addTween(bounce);
      });
    });
    this.renderer.addTween(knifeTw);
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const sample = TEXT_SAMPLES[this.sampleIndex];

    // --- Title ---
    const title = new Text("分词器: 文本切分为 Token", w / 2, 30, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // --- Metaphor label ---
    const metaphor = new Text("🎂 分词 = 把文本切成小块", w / 2, 56, 14);
    metaphor.fillStyle = COLORS.highlight;
    this.scene.add(metaphor);

    // --- Input text as a cake/candy bar ---
    const inputLabel = new Text("输入文本", w / 2, 90, 12);
    inputLabel.fillStyle = COLORS.textDim;
    this.scene.add(inputLabel);

    const barY = 130;
    const barW = Math.min(w - 80, 560);
    const barH = 56;
    const barLeft = w / 2 - barW / 2;

    // The bar background (cake).
    const bar = new Rect(w / 2, barY, barW, barH, 8);
    bar.fillStyle = "rgba(0, 217, 255, 0.06)";
    bar.strokeStyle = COLORS.accent;
    bar.lineWidth = 1;
    this.scene.add(bar);

    // Text inside the bar.
    const inputText = new Text(sample.source, w / 2, barY, 20);
    inputText.fillStyle = COLORS.text;
    inputText.fontWeight = "bold";
    this.scene.add(inputText);

    // --- Knife line coming down to cut the bar ---
    const usableW = barW - 48;
    const charWidth = sample.source.length > 0 ? usableW / sample.source.length : 0;
    const inputLeft = barLeft + 24;

    // Draw the knife at each token boundary (descending with progress).
    sample.tokens.forEach((tok, i) => {
      if (i === 0) return; // no cut before the first token
      const cutX = inputLeft + tok.start * charWidth;
      const knifeTop = barY - barH / 2 - 70;
      const knifeBottom = barY + barH / 2 + 6;
      const knifeY = knifeTop + (knifeBottom - knifeTop) * this.knife.progress;
      const knife = new Line(cutX, knifeY, cutX, knifeY + 36);
      knife.strokeStyle = COLORS.highlight;
      knife.lineWidth = 2.5;
      this.scene.add(knife);
      // Knife handle
      const handle = new Rect(cutX, knifeY - 6, 10, 12, 2);
      handle.fillStyle = COLORS.accent3;
      handle.strokeStyle = "transparent";
      this.scene.add(handle);
    });

    // --- Token boxes (bounce into position) ---
    const tokenBoxW = Math.max(64, Math.min(110, (w - 60) / sample.tokens.length - 14));
    const tokenBoxH = 54;
    const gap = 14;
    const totalRowW = sample.tokens.length * tokenBoxW + (sample.tokens.length - 1) * gap;
    const tokenY = 250;
    const startX = w / 2 - totalRowW / 2;

    const tokensLabel = new Text("Token 序列", w / 2, tokenY - 46, 12);
    tokensLabel.fillStyle = COLORS.textDim;
    this.scene.add(tokensLabel);

    sample.tokens.forEach((tok, i) => {
      const bx = startX + i * (tokenBoxW + gap) + tokenBoxW / 2;
      const color = TOKEN_PALETTE[i % TOKEN_PALETTE.length];
      const scale = this.tokenScales[i] ?? 0;
      if (scale <= 0.001) return;

      // Token box (scaled by bounce).
      const box = new Rect(bx, tokenY, tokenBoxW, tokenBoxH, 8);
      box.scale = scale;
      box.fillStyle = color;
      box.opacity = 0.18;
      box.strokeStyle = color;
      box.lineWidth = 2;
      this.scene.add(box);

      // Token index badge
      const badge = new Rect(bx, tokenY - tokenBoxH / 2 - 12, 22, 16, 8);
      badge.scale = scale;
      badge.fillStyle = color;
      this.scene.add(badge);
      const badgeText = new Text(String(i), bx, tokenY - tokenBoxH / 2 - 12, 11);
      badgeText.scale = scale;
      badgeText.fillStyle = COLORS.bg;
      badgeText.fontWeight = "bold";
      this.scene.add(badgeText);

      // Token text label
      const tokText = new Text(tok.text, bx, tokenY, 18);
      tokText.scale = scale;
      tokText.fillStyle = color;
      tokText.fontWeight = "bold";
      this.scene.add(tokText);

      // Arrow from source text segment to this token box.
      const segStart = inputLeft + tok.start * charWidth;
      const segLen = tok.text.length * charWidth;
      const segCx = segStart + segLen / 2;
      const arrowOpacity = Math.min(1, scale);
      const arrow = new Arrow(segCx, barY + barH / 2 + 4, bx, tokenY - tokenBoxH / 2 - 2, 7);
      arrow.strokeStyle = color;
      arrow.lineWidth = 1.5;
      arrow.opacity = arrowOpacity;
      this.scene.add(arrow);

      // Small tick under the input text marking the segment.
      const tick = new Line(segStart, barY + barH / 2 + 2, segStart + segLen, barY + barH / 2 + 2);
      tick.strokeStyle = color;
      tick.lineWidth = 3;
      tick.opacity = arrowOpacity;
      this.scene.add(tick);
    });

    // --- Token count ---
    const countY = tokenY + tokenBoxH / 2 + 46;
    const countText = new Text(`共 ${sample.tokens.length} 个 token`, w / 2, countY, 16);
    countText.fillStyle = COLORS.highlight;
    countText.fontWeight = "bold";
    this.scene.add(countText);

    // --- BPE note ---
    const noteText = new Text("BPE: 高频字符对逐步合并", w / 2, countY + 30, 13);
    noteText.fillStyle = COLORS.textDim;
    this.scene.add(noteText);

    // --- Illustrative merge example at the bottom ---
    const exampleY = h - 40;
    if (sample.source === "我爱人工智能") {
      this.drawMergeExample(w / 2, exampleY, "人", "工", "人工");
    } else if (sample.source === "Transformer is powerful") {
      this.drawMergeExample(w / 2, exampleY, "Transform", "er", "Transformer");
    } else {
      this.drawMergeExample(w / 2, exampleY, "今", "天", "今天");
    }

    this.renderer.renderOnce();
  }

  /** Draw a small "a + b -> ab" merge illustration centered at (cx, cy). */
  private drawMergeExample(cx: number, cy: number, a: string, b: string, merged: string): void {
    const boxW = 64;
    const boxH = 26;
    const gap = 14;

    const totalW = boxW * 2 + gap + 24 + boxW + gap;
    const startX = cx - totalW / 2;

    const ax = startX + boxW / 2;
    const aBox = new Rect(ax, cy, boxW, boxH, 6);
    aBox.fillStyle = COLORS.accent2;
    aBox.opacity = 0.18;
    aBox.strokeStyle = COLORS.accent2;
    aBox.lineWidth = 1.5;
    this.scene.add(aBox);
    const aTxt = new Text(a, ax, cy, 14);
    aTxt.fillStyle = COLORS.accent2;
    aTxt.fontWeight = "bold";
    this.scene.add(aTxt);

    const plus = new Text("+", ax + boxW / 2 + gap / 2, cy, 14);
    plus.fillStyle = COLORS.textDim;
    this.scene.add(plus);

    const bx = ax + boxW + gap + boxW / 2;
    const bBox = new Rect(bx, cy, boxW, boxH, 6);
    bBox.fillStyle = COLORS.accent2;
    bBox.opacity = 0.18;
    bBox.strokeStyle = COLORS.accent2;
    bBox.lineWidth = 1.5;
    this.scene.add(bBox);
    const bTxt = new Text(b, bx, cy, 14);
    bTxt.fillStyle = COLORS.accent2;
    bTxt.fontWeight = "bold";
    this.scene.add(bTxt);

    const arrowX1 = bx + boxW / 2 + 4;
    const arrow = new Arrow(arrowX1, cy, arrowX1 + 22, cy, 7);
    arrow.strokeStyle = COLORS.textDim;
    arrow.lineWidth = 1.5;
    this.scene.add(arrow);

    const mx = arrowX1 + 22 + 4 + boxW / 2;
    const mBox = new Rect(mx, cy, boxW, boxH, 6);
    mBox.fillStyle = COLORS.accent;
    mBox.opacity = 0.22;
    mBox.strokeStyle = COLORS.accent;
    mBox.lineWidth = 1.5;
    this.scene.add(mBox);
    const mTxt = new Text(merged, mx, cy, 14);
    mTxt.fillStyle = COLORS.accent;
    mTxt.fontWeight = "bold";
    this.scene.add(mTxt);
  }
}
