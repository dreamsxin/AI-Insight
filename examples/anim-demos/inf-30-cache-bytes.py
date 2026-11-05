#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-30 一个 token 的账

对应动画：docs/inf-30-cache-bytes-animation.html

这一份把 288 与 528 逐字节数出来：
  1. 同样 512 个值，per-16 FP4 与 MXFP8 各占多少字节
  2. 少占的 240 B 里，有多少是「省下来的」，多少是「转嫁到 scale 上的」
  3. 为什么 528 除不尽 32 —— 一个 token 切不齐，两个才切得齐
  4. 层数不等于副本数：mapped layer 共用一份 cache

    python examples/anim-demos/inf-30-cache-bytes.py
"""
from math import gcd

VALS = 512          # 一个 token 在一层里的 KV 元素数（示意：8 头 × 64 维）
ALIGN = 32          # block 对齐字节数


def fmt(n):
    return "%d B" % n


def main():
    # ── 两种格式的账 ───────────────────────────────────────────────────
    fp4_data = VALS * 4 // 8                     # 4 bit/值
    fp4_scale = VALS // 16                       # 每 16 个值一个 ue8m0 scale（1 B）
    mxfp8_data = VALS * 8 // 8                   # 8 bit/值
    mxfp8_scale = VALS // 32                     # 每 32 个值一个

    print("一、同样 %d 个值，两种存法" % VALS)
    print("  per-16 FP4   数据 %s + scale %s = %s"
          % (fmt(fp4_data), fmt(fp4_scale), fmt(fp4_data + fp4_scale)))
    print("  MXFP8        数据 %s + scale %s = %s"
          % (fmt(mxfp8_data), fmt(mxfp8_scale), fmt(mxfp8_data + mxfp8_scale)))

    a, b = fp4_data + fp4_scale, mxfp8_data + mxfp8_scale
    print()
    print("  少占 %s。拆开看：" % fmt(b - a))
    print("    数据省 %s（位宽砍半）" % fmt(mxfp8_data - fp4_data))
    print("    scale 多 %s（密度从每 32 个翻到每 16 个）" % fmt(fp4_scale - mxfp8_scale))
    print("    净省 %s —— 位宽减半只省下 %.0f%%，不是 50%%"
          % (fmt((mxfp8_data - fp4_data) - (fp4_scale - mxfp8_scale)),
             (b - a) / b * 100))

    # ── 对齐 ───────────────────────────────────────────────────────────
    print()
    print("二、为什么 528 除不尽 32")
    print("  %d ÷ %d = %.1f —— 一个 token 切不齐，尾巴剩 %d B" % (b, ALIGN, b / ALIGN, b % ALIGN))
    l = b * ALIGN // gcd(b, ALIGN)
    print("  lcm(%d, %d) = %d B = %d 个 token" % (b, ALIGN, l, l // b))
    print("  所以要按 %d 个 token 一组对齐写盘，而不是按 1 个。" % (l // b))
    la = a * ALIGN // gcd(a, ALIGN)
    print("  per-16 FP4 的 %d = %d × %d，一个 token 就对得齐（lcm = %d）。"
          % (a, ALIGN, a // ALIGN, la))
    print("  所以「288 更省」不只是省字节，还省掉了一半的对齐零头。")

    # ── 层数 ≠ 副本数 ──────────────────────────────────────────────────
    print()
    print("三、层数不等于副本数")
    layers = 61
    owners = 3
    print("  %d 层，但只有 %d 份 cache —— 因为相邻层共用同一块（mapped layer）。" % (layers, owners))
    print("  按层算：%d × %s = %.1f KB / token" % (layers, fmt(b), layers * b / 1024))
    print("  按份算：%d × %s = %.1f KB / token" % (owners, fmt(b), owners * b / 1024))
    print("  差 %.1f 倍。做容量规划时按层乘，会多买 %.0f 倍的显存。"
          % (layers / owners, layers / owners - 1))

    # ── 落到一个请求上 ──────────────────────────────────────────────────
    print()
    print("四、落到一个请求上（1000 token，61 层里 3 份 cache）")
    for name, per in (("per-16 FP4", a), ("MXFP8", b)):
        print("  %-12s %.1f MB" % (name, per * owners * 1000 / 1024 / 1024))
    print("  同一台机器、同一个请求，格式一换就差出 %.1f MB。"
          % ((b - a) * owners * 1000 / 1024 / 1024))

    assert a == 288 and b == 528
    assert b % ALIGN == 16, "528 对 32 取余应该是 16"
    assert l == 1056 and l // b == 2
    print("\n[自检] 288 / 528、528 mod 32 = 16、lcm = 1056（2 个 token） —— 与动画一致")


if __name__ == "__main__":
    main()
