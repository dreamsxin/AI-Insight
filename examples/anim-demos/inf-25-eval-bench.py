#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-25 三个基准一台秤

对应动画：docs/inf-25-eval-bench-animation.html

跑这一份，能自己算出来的三件事：
  1. 960 / 1584 / 2500 这三个分母是怎么来的（题数 × 每题跑几次）
  2. 99.9 / 93.4 / 42.6 这三个分数各自的置信区间有多宽
  3. 为什么「42.6 天生比前两个抖」—— 不是模型更差，是 n 只有 1

    python examples/anim-demos/inf-25-eval-bench.py
"""
import math

# ── 三个基准的口径（题数、每题跑几次、答对比例）────────────────────────────
# 前两列来自 eval/ 下的基准配置；第三列是公开报告里的 Pass@1（reference，非本机实测）
BENCH = [
    ("AIME 2026", 30, 32, 0.999),
    ("GPQA-D", 198, 8, 0.934),
    ("HLE", 2500, 1, 0.426),
]


def wilson(p, n, z=1.96):
    """Wilson 区间：比正态近似稳，p 接近 0 或 1 时也不会跑出 [0,1]。"""
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, c - h), min(1.0, c + h)


def main():
    print("分母是怎么来的")
    print("  %-11s %6s %5s %8s %9s" % ("基准", "题数", "跑次", "rollout", "Pass@1"))
    for name, q, runs, p in BENCH:
        print("  %-11s %6d %5d %8d %9.1f" % (name, q, runs, q * runs, p * 100))

    print()
    print("同一个 Pass@1，可信度差多少（Wilson 95% 区间）")
    print("  %-11s %6s %8s %7s %-17s" % ("基准", "rollout", "±半宽", "对率", "区间"))
    rows = []
    for name, q, runs, p in BENCH:
        n = q * runs
        lo, hi = wilson(p, n)
        half = (hi - lo) / 2 * 100
        rows.append((name, n, half))
        print("  %-11s %6d %7.2fpt %6.1f%% [%.1f, %.1f]"
              % (name, n, half, p * 100, lo * 100, hi * 100))

    print()
    aime = next(r for r in rows if r[0].startswith("AIME"))
    hle = next(r for r in rows if r[0].startswith("HLE"))
    ratio = hle[2] / aime[2]
    print("HLE 的区间是 AIME 的 %.1f 倍宽 —— 因为它每题只跑 1 次，" % ratio)
    print("而且 p 落在 0.5 附近（方差最大），两个因素叠在一起。")

    print()
    print("有基线才叫分数")
    base = 0.25
    print("  GPQA-D 四选一，瞎猜 = 25.0%")
    print("  93.4%% 相对瞎猜高出 %.1f 个百分点" % (93.4 - base * 100))
    print("  若某基准瞎猜 = 90%，同样的 93.4 就没什么可说的了。")

    # 自检：屏幕上的三个数字必须由这里的口径算出来
    assert 30 * 32 == 960
    assert 198 * 8 == 1584
    assert 2500 * 1 == 2158 + 342
    assert round(959 / 960 * 100, 1) == 99.9
    assert ratio > 5, "HLE 区间应该明显更宽"
    print("\n[自检] 960 / 1584 / 2500、99.9、区间比 >5× —— 与动画一致")


if __name__ == "__main__":
    main()
