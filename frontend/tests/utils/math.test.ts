/** Tests for math utility functions. */

import { describe, it, expect } from "vitest";
import { sigmoid, relu, tanh, step, softmax, matmul, lerp, clamp, mapRange, mulberry32 } from "@/utils/math";

describe("math utilities", () => {
  describe("activation functions", () => {
    it("sigmoid returns value in (0, 1)", () => {
      expect(sigmoid(0)).toBeCloseTo(0.5);
      expect(sigmoid(100)).toBeCloseTo(1);
      expect(sigmoid(-100)).toBeCloseTo(0);
    });

    it("relu returns max(0, x)", () => {
      expect(relu(5)).toBe(5);
      expect(relu(-3)).toBe(0);
      expect(relu(0)).toBe(0);
    });

    it("tanh returns value in (-1, 1)", () => {
      expect(tanh(0)).toBeCloseTo(0);
      expect(tanh(100)).toBeCloseTo(1);
      expect(tanh(-100)).toBeCloseTo(-1);
    });

    it("step returns 0 or 1", () => {
      expect(step(1)).toBe(1);
      expect(step(-1)).toBe(0);
      expect(step(0)).toBe(0);
    });
  });

  describe("softmax", () => {
    it("returns values that sum to 1", () => {
      const result = softmax([1, 2, 3]);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1);
    });

    it("larger input gets larger probability", () => {
      const result = softmax([0, 0, 10]);
      expect(result[2]).toBeGreaterThan(result[0]);
      expect(result[2]).toBeGreaterThan(result[1]);
    });
  });

  describe("matmul", () => {
    it("multiplies two matrices correctly", () => {
      const a = [[1, 2], [3, 4]];
      const b = [[5, 6], [7, 8]];
      const result = matmul(a, b);
      expect(result).toEqual([[19, 22], [43, 50]]);
    });

    it("handles non-square matrices", () => {
      const a = [[1, 2, 3]]; // 1x3
      const b = [[4], [5], [6]]; // 3x1
      const result = matmul(a, b);
      expect(result).toEqual([[32]]);
    });
  });

  describe("lerp", () => {
    it("interpolates between two values", () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });

  describe("clamp", () => {
    it("clamps values to range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe("mapRange", () => {
    it("maps a value from one range to another", () => {
      expect(mapRange(0.5, 0, 1, 0, 100)).toBeCloseTo(50);
      expect(mapRange(0, -1, 1, 0, 10)).toBeCloseTo(5);
    });
  });

  describe("mulberry32", () => {
    it("produces deterministic random with same seed", () => {
      const rng1 = mulberry32(42);
      const rng2 = mulberry32(42);
      expect(rng1()).toBe(rng2());
      expect(rng1()).toBe(rng2());
    });

    it("produces values in [0, 1)", () => {
      const rng = mulberry32(123);
      for (let i = 0; i < 100; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });
});
