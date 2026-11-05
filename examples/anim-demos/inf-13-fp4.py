#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-13 四位数够用

对应动画：docs/inf-13-fp4-animation.html

把「4 位只有 8 档」这件事真的跑一遍：
  1. FP4（e2m1）的 8 个正数档位是哪几个
  2. 单独一个 4 位数表示 2.7，误差有多大
  3. 加一把 per-32 的尺子之后，同一批数的误差降到多少
  4. 为什么 4 位不是免费的：离群值会把整组压扁

    python examples/anim-demos/inf-13-fp4.py
"""
import random

# e2m1：1 符号 + 2 指数 + 1 尾数。正数一共 8 档（含 0 与一个次正规）
LEVELS = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0]
GROUP = 32


def q(x, scale):
    """挑最接近的一档，再乘回尺子。"""
    best = min(LEVELS, key=lambda L: abs(L * scale - x))
    return best * scale


def err(xs, scale):
    return sum(abs(q(x, scale) - x) for x in xs) / len(xs)


def main():
    print("一、8 个档位")
    print("  " + "  ".join("%g" % L for L in LEVELS))
    print("  相邻间隔从 0.5 一路涨到 2 —— 越大的数越粗，这是浮点的本性。")

    print()
    print("二、单独一个 4 位数")
    v = 2.7
    print("  要表示 %.1f：最近的两档是 %.1f 和 %.1f" % (v, 2.0, 3.0))
    print("  只能记成 %.1f，误差 %.0f%%" % (q(v, 1.0), abs(q(v, 1.0) - v) / v * 100))
    for x in (0.30, 0.07, 0.02):
        print("  小量级 %.2f → 塌成 %.1f（误差 %.0f%%）" % (x, q(x, 1.0), abs(q(x, 1.0) - x) / x * 100))
    print("  量级再小一点就全是 0 —— 所以必须有尺子。")

    print()
    print("三、加一把 per-%d 的尺子" % GROUP)
    rng = random.Random(13)
    for name, base, spread in (("量级 0.05", 0.05, 0.015), ("量级 1.0", 1.0, 0.3)):
        xs = [abs(rng.gauss(base, spread)) for _ in range(GROUP)]
        s = max(xs) / max(LEVELS)
        e0 = err(xs, 1.0)                     # 不带尺子
        e1 = err(xs, s)                       # 带尺子
        print("  %-10s 不带尺子平均误差 %6.3f → 带尺子 %6.4f（改善 %.0f 倍）"
              % (name, e0, e1, e0 / e1))

    print("  量级接近 1 时改善有限 —— 8 档本来就落在这一段；")
    print("  尺子的价值在于「把档位搬到任意量级」，而不是提高分辨率。")

    print()
    print("四、离群值的代价")
    xs = [abs(rng.gauss(1.0, 0.2)) for _ in range(GROUP - 1)] + [40.0]
    s = max(xs) / max(LEVELS)
    body = xs[:-1]
    print("  一组 %d 个正常数 + 1 个 40.0" % (GROUP - 1))
    print("  尺子被拉到 %.2f，其余 %d 个数落到 %.2f 以下 —— 只剩 2–3 档可用"
          % (s, GROUP - 1, 2 * s))
    print("  正常数的平均误差：%.4f（没有离群值时是 %.4f）"
          % (err(body, s), err(body, max(body) / max(LEVELS))))
    print("  这就是要 per-16 而不是 per-128 的理由：组越小，离群值影响的人越少。")

    assert len(LEVELS) == 8
    assert abs(q(2.7, 1.0) - 3.0) < 1e-9
    assert err(body, s) > err(body, max(body) / max(LEVELS))
    print("\n[自检] 8 档、2.7→3（误差 11%）、离群值把同组压扁 —— 与动画一致")


if __name__ == "__main__":
    main()
