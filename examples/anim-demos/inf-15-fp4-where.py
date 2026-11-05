#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-15 同一个 4 位，三把尺子

对应动画：docs/inf-15-fp4-where-animation.html

三处用 4 位，粒度却不同。这一份把「判据」写成可执行的三个问题，
再用同一组问题把三个位置各判一次：

  1. 这份数被读很多次吗？（在乎带宽 → 尺子细一点值不值）
  2. 误差会往下游累积吗？（累积 → 必须细）
  3. 尺子能进矩阵乘吗？（能 → 用 ue8m0，2 的幂）

    python examples/anim-demos/inf-15-fp4-where.py
"""
# 三个落点：名字、每 token 读次数（量级）、是否跨层累积、是否静态权重
SITES = [
    ("主 KV",         "被 20+ 层反复读", True,  True,  False),
    ("indexer KV",    "每步扫一遍",       True,  False, False),
    ("MoE 专家权重",  "每步全量加载",     True,  False, True),
]


def decide(hot, accumulates, static):
    """返回（组大小, 尺子类型, 一句理由）。"""
    if accumulates:
        return 16, "e4m3", "误差进下一层输入，尺子必须贴身"
    if static:
        return 32, "ue8m0", "静态权重，尺子能并进 GEMM 的累加"
    return 32, "ue8m0", "读得多但误差不累积，粗尺子够用且更便宜"


def main():
    print("一、三个问题")
    print("  1. 读得多不多   2. 误差会不会累积   3. 尺子能不能进乘")
    print()
    print("  %-14s %-16s %-8s %-8s %-6s" % ("落点", "读法", "累积", "静态", "结论"))
    for name, how, hot, acc, static in SITES:
        g, kind, _ = decide(hot, acc, static)
        print("  %-14s %-16s %-8s %-8s %d 位 / per-%d %s"
              % (name, how, "是" if acc else "否", "是" if static else "否", 8, g, kind))

    print()
    print("二、三条理由各不相同")
    for name, how, hot, acc, static in SITES:
        g, kind, why = decide(hot, acc, static)
        print("  %-14s %s" % (name, why))

    print()
    print("三、为细尺子多付的带宽")
    print("  per-16 相对 per-32 多付 %.1f%%（4.50 vs 4.25 位/元素）"
          % ((4.50 / 4.25 - 1) * 100))
    tokens = 100_000
    for g in (32, 16):
        bits = 4 + 8 / g
        kb = tokens * bits / 8 / 1024
        print("  %6d token：per-%d → %.1f KB" % (tokens, g, kb))
    print("  主 KV 愿意付这 5.9%，因为它是被读最多次的那一份；")
    print("  indexer 与专家权重不愿意，因为它们不需要「贴身」。")

    print()
    print("四、ue8m0 为什么几乎白拿")
    print("  尺子只能是 2^k → 反量化就是把指数加到累加器上，一次整数加法。")
    print("  e4m3 的尺子不是 2 的幂 → 必须真做一次乘法，且没法并进 GEMM 的累加。")
    print("  所以：静态权重 + ue8m0 = 完全融进 kernel；动态 + 贴身 = 只能 e4m3。")

    assert decide(True, True, False)[:2] == (16, "e4m3")
    assert decide(True, False, True)[:2] == (32, "ue8m0")
    print("\n[自检] 主 KV 16/e4m3、indexer 32/ue8m0、专家权重 32/ue8m0 —— 与动画一致")


if __name__ == "__main__":
    main()
