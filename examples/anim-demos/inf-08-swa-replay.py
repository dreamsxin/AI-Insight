#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-08 只重算 128 个 token

对应动画：docs/inf-08-swa-replay-animation.html

滑动窗口（SWA）的缓存很小，但「重建」可以很贵：
精确重建要跑 2560 个 token × 20 层；有界重放只跑 128 个。

这一份算：
  1. 两种做法的计算量与缓存体积
  2. 为什么每层只要 134 个位置（128 窗口 + 6 个投机回溯位）
  3. 命中不够时「回退一格」的代价

    python examples/anim-demos/inf-08-swa-replay.py
"""
WINDOW = 128
LOOKBACK = 6           # 投机解码可能要回看几步
HISTORY = 2560         # 需要重建的历史长度
LAYERS = 20
BYTES = 528            # 每 token 每层（MXFP8）


def main():
    print("一、两种重建方式")
    print("  精确重建：%d token × %d 层 = %d 个 token-层" % (HISTORY, LAYERS, HISTORY * LAYERS))
    print("  有界重放：%d token × %d 层 = %d 个 token-层" % (WINDOW, LAYERS, WINDOW * LAYERS))
    print("  少算 %.0f 倍 —— 而且窗口宽度是常数，与历史多长无关。"
          % (HISTORY / WINDOW))
    for hist in (2560, 25600, 256000):
        print("  历史 %6d token → 精确重建 %8d token-层 / 重放 %5d token-层"
              % (hist, hist * LAYERS, WINDOW * LAYERS))

    print()
    print("二、为什么是 134 而不是 128")
    slot = WINDOW + LOOKBACK
    print("  窗口 %d + 投机回溯 %d = %d 个位置" % (WINDOW, LOOKBACK, slot))
    print("  缓存体积 = %d 层 × %d × %d B = %.2f MB / 序列"
          % (LAYERS, slot, BYTES, LAYERS * slot * BYTES / 2**20))
    print("  1.35 MB 是个小数字 —— 所以它敢放主机内存，而不是共享存储。")
    print("  这也解释了「最多超 5 个 token」：环形缓冲多出的 %d 个位正好吸收。" % LOOKBACK)

    print()
    print("三、什么时候存")
    print("  不是想存就存，只在 %d 的倍数上存：" % WINDOW)
    for L in (2432, 2560, 2690):
        base = L // WINDOW * WINDOW
        print("  位置 %5d → 对齐到 %5d（预留最后一个 token，向下取整）" % (L, base))
    print("  不足一整个 128 单位就不存；分片 prefill 中途也不存。")

    print()
    print("四、命中不够时回退一格")
    print("  区间 [L1−128, L1] 里没有窗口缓存 → 回退到 L1−128 重算最后 128 个。")
    print("  代价：多算 %d 个 token（不是重算 %d 个）。" % (WINDOW, HISTORY))
    print("  收益：缓存不会「差不多对」—— 宁可少命中 128 个，也不传播不准确的缓存。")
    print("  这条比性能重要：错误的 KV 会让模型安静地说错话，且无法复现。")

    assert LAYERS * (WINDOW + LOOKBACK) * BYTES / 2**20 < 1.5
    assert HISTORY // WINDOW == 20
    print("\n[自检] 2560/128 = 20 倍、134 个位置、1.35 MB/序列 —— 与动画一致")


if __name__ == "__main__":
    main()
