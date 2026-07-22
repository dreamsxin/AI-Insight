/** LongDependencyViz - shows how information degrades over long RNN sequences.

Draws a chain of nodes connected left-to-right. The connection lines fade
(opacity + thickness decrease) with distance from the first node, illustrating
that early information is progressively lost as the sequence grows. A signal-
strength bar is drawn under each node to visualise the gradient of retained info.
*/

import { BaseVisualization } from "@/visualizations/BaseVisualization";
import { Text } from "@/canvas/shapes/Text";
import { Circle } from "@/canvas/shapes/Circle";
import { Line } from "@/canvas/shapes/Line";
import { Rect } from "@/canvas/shapes/Rect";
import { COLORS } from "@/utils/color";
import { clamp, mapRange } from "@/utils/math";

export class LongDependencyViz extends BaseVisualization {
  onMount(): void {
    this.render();
  }

  onControlChange(_key: string, _value: number): void {
    this.render();
  }

  private get seqLen(): number {
    return Math.max(4, Math.min(12, Math.floor(this.controls["seq_len"] ?? 8)));
  }

  private render(): void {
    this.scene.clear();
    const w = this.width;
    const h = this.height;
    const n = this.seqLen;

    // Title
    const title = new Text("长依赖问题: 序列越长，早期信息丢失越多", w / 2, 32, 18);
    title.fillStyle = COLORS.accent;
    title.fontWeight = "bold";
    this.scene.add(title);

    // Layout: nodes along a horizontal row in the upper-middle band.
    const rowY = h * 0.42;
    const padX = 70;
    const span = w - padX * 2;
    const spacing = n > 1 ? span / (n - 1) : 0;
    const nodeR = 16;

    // --- Connection lines (drawn first, behind nodes) ---
    // Each line from node 0 to node i fades with distance.
    for (let i = 0; i < n; i++) {
      const x0 = padX;
      const x1 = padX + i * spacing;
      // Strength decays exponentially with distance from the source (node 0).
      const strength = Math.exp(-(i / n) * 3.2); // 1.0 -> ~0.07
      const line = new Line(x0, rowY, x1, rowY);
      line.strokeStyle = strength > 0.3 ? COLORS.accent : COLORS.edge;
      line.lineWidth = mapRange(strength, 0, 1, 0.8, 4);
      line.opacity = clamp(strength, 0.12, 1);
      this.scene.add(line);
    }

    // Also draw consecutive node-to-node links to suggest the recurrent chain.
    for (let i = 0; i < n - 1; i++) {
      const x0 = padX + i * spacing;
      const x1 = padX + (i + 1) * spacing;
      const link = new Line(x0, rowY, x1, rowY);
      link.strokeStyle = "rgba(148, 163, 184, 0.25)";
      link.lineWidth = 1;
      this.scene.add(link);
    }

    // --- Nodes ---
    for (let i = 0; i < n; i++) {
      const cx = padX + i * spacing;
      const isFirst = i === 0;
      const isLast = i === n - 1;
      const strength = Math.exp(-(i / n) * 3.2);

      // Node fill: bright at the start, fading toward the end.
      const node = new Circle(cx, rowY, nodeR);
      node.fillStyle = isFirst
        ? COLORS.accent
        : `rgba(0, 217, 255, ${clamp(strength * 0.9, 0.08, 0.9)})`;
      node.strokeStyle = isFirst ? COLORS.accent : COLORS.edge;
      node.lineWidth = isFirst ? 2.5 : 1;
      this.scene.add(node);

      // Node label
      const label = new Text(`t=${i}`, cx, rowY - nodeR - 12, 11);
      label.fillStyle = COLORS.textDim;
      this.scene.add(label);

      // Signal-strength bar below each node.
      const barW = Math.max(8, spacing * 0.5);
      const barMaxH = 70;
      const barH = clamp(strength * barMaxH, 4, barMaxH);
      const barX = cx;
      const barY = rowY + nodeR + 24;

      // Bar background
      const bg = new Rect(barX, barY + barMaxH / 2, barW, barMaxH, 3);
      bg.fillStyle = "rgba(255,255,255,0.05)";
      bg.strokeStyle = "transparent";
      this.scene.add(bg);

      // Bar fill (grows from the bottom).
      const fill = new Rect(barX, barY + barMaxH - barH / 2, barW, barH, 3);
      const hue = (1 - strength) * 240; // strong=blue(240 region)/red. Use heatmap-like.
      fill.fillStyle = `hsl(${hue}, 75%, 55%)`;
      fill.strokeStyle = "transparent";
      this.scene.add(fill);

      // Percentage label
      const pct = Math.round(strength * 100);
      const pctLabel = new Text(`${pct}%`, cx, barY + barMaxH + 14, 10);
      pctLabel.fillStyle = strength > 0.4 ? COLORS.text : COLORS.textDim;
      this.scene.add(pctLabel);
    }

    // "source" label at the first node
    const srcLabel = new Text("早期信息", padX, rowY - nodeR - 30, 12);
    srcLabel.fillStyle = COLORS.accent;
    srcLabel.fontWeight = "bold";
    this.scene.add(srcLabel);

    // Axis: a simple time arrow under the bars.
    const axisY = rowY + nodeR + 24 + 70 + 30;
    const axis = new Line(padX, axisY, w - padX, axisY);
    axis.strokeStyle = COLORS.textDim;
    axis.lineWidth = 1;
    this.scene.add(axis);

    const axisL = new Text("时间步 ->", w / 2, axisY + 16, 12);
    axisL.fillStyle = COLORS.textDim;
    this.scene.add(axisL);

    // --- Explanatory text ---
    const explain = new Text("随着序列变长，早期信息逐渐丢失", w / 2, h - 44, 15);
    explain.fillStyle = COLORS.accent3;
    explain.fontWeight = "bold";
    this.scene.add(explain);

    const detail = new Text(
      "梯度/信号在反向传播经过每一时间步时衰减（指数衰减），RNN 难以记住远处的信息",
      w / 2,
      h - 22,
      12,
    );
    detail.fillStyle = COLORS.textDim;
    this.scene.add(detail);
  }
}
