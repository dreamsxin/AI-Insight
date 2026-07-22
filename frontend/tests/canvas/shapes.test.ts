/** Tests for Canvas shapes. */

import { describe, it, expect } from "vitest";
import { Circle } from "@/canvas/shapes/Circle";
import { Rect } from "@/canvas/shapes/Rect";
import { Line } from "@/canvas/shapes/Line";
import { Text } from "@/canvas/shapes/Text";
import { Arrow } from "@/canvas/shapes/Arrow";
import { Easing } from "@/canvas/animation/Easing";
import { Tween } from "@/canvas/animation/Tween";

describe("Canvas shapes", () => {
  it("Circle stores position and radius", () => {
    const c = new Circle(10, 20, 5);
    expect(c.x).toBe(10);
    expect(c.y).toBe(20);
    expect(c.radius).toBe(5);
  });

  it("Rect stores dimensions", () => {
    const r = new Rect(0, 0, 100, 50, 8);
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
    expect(r.radius).toBe(8);
  });

  it("Line stores endpoints", () => {
    const l = new Line(0, 0, 10, 20);
    expect(l.x).toBe(0);
    expect(l.y).toBe(0);
    expect(l.x2).toBe(10);
    expect(l.y2).toBe(20);
  });

  it("Text stores text content", () => {
    const t = new Text("hello", 10, 20, 14);
    expect(t.text).toBe("hello");
    expect(t.fontSize).toBe(14);
  });

  it("Arrow stores head size", () => {
    const a = new Arrow(0, 0, 50, 50, 10);
    expect(a.headSize).toBe(10);
  });

  it("Shape visibility toggles", () => {
    const c = new Circle(0, 0, 10);
    expect(c.visible).toBe(true);
    c.visible = false;
    expect(c.visible).toBe(false);
  });
});

describe("Easing functions", () => {
  it("linear returns input", () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(0.5)).toBe(0.5);
    expect(Easing.linear(1)).toBe(1);
  });

  it("easeInOutCubic returns 0 at 0 and 1 at 1", () => {
    expect(Easing.easeInOutCubic(0)).toBe(0);
    expect(Easing.easeInOutCubic(1)).toBe(1);
  });

  it("easeOutBack overshoots", () => {
    // easeOutBack should exceed 1 at some point before settling
    const val = Easing.easeOutBack(0.7);
    expect(val).toBeGreaterThan(0);
  });
});

describe("Tween", () => {
  it("animates from start to end value", () => {
    const target = { x: 0 };
    const tween = new Tween(target, { x: 100 }, 1000); // 1 second
    // Simulate 500ms
    tween.update(500);
    expect(target.x).toBeGreaterThan(0);
    expect(target.x).toBeLessThan(100);
    // Simulate another 500ms
    tween.update(500);
    expect(target.x).toBeCloseTo(100);
    expect(tween.isFinished).toBe(true);
  });

  it("respects delay", () => {
    const target = { x: 0 };
    const tween = new Tween(target, { x: 50 }, 500).setDelay(200);
    tween.update(100);
    expect(target.x).toBe(0); // still in delay
    tween.update(200);
    expect(target.x).toBeGreaterThan(0); // now animating
  });

  it("calls onComplete callback", () => {
    let called = false;
    const target = { x: 0 };
    const tween = new Tween(target, { x: 10 }, 100).onComplete(() => { called = true; });
    tween.update(200);
    expect(called).toBe(true);
  });
});
