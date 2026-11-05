#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-14 尺子放多细

对应动画：docs/inf-14-scale-grain-animation.html

「4 位其实不是 4 位」这句话，可以精确到小数点后两位：
  1. 三种粒度的有效位宽：4.25 / 4.53 / 8.06
  2. per-16 比 per-32 多付的 6.6% 是从哪来的
  3. 四把 ue8m0 为什么塞进一个 int32 —— 一行的 int32 个数是 d/128

    python examples/anim-demos/inf-14-scale-grain.py
"""
D = 7168          # 一层 hidden 维（示意）
BLOCK_M = 64


def bits_per_elem(data_bits, group):
    """每个元素摊到的有效位宽 = 数据位 + 每组的 8 位尺子摊薄。"""
    return data_bits + 8 / group


def main():
    print("一、有效位宽")
    rows = [
        ("bf16", 16, None),
        ("fp8 / per-128", 8, 128),
        ("fp4 / per-16", 4, 16),
        ("fp4 / per-32", 4, 32),
    ]
    for name, db, g in rows:
        v = db if g is None else bits_per_elem(db, g)
        print("  %-14s %6.2f bit/元素%s"
              % (name, v, "" if g is None else "   (= %d + 8/%d)" % (db, g)))

    a, b = bits_per_elem(4, 32), bits_per_elem(4, 16)
    print()
    print("  per-16 比 per-32 多付 %.1f%% —— 尺子密一倍，尺子本身就要多占一倍。"
          % ((b / a - 1) * 100))
    print("  注意这不是「精度提升 5.9%」，只是「多花 5.9% 的带宽买更贴身的尺子」。")

    print()
    print("二、四把尺子塞进一个 int32")
    print("  ue8m0 是 8 位 → 4 个正好填满 32 位")
    n_scale = D // 32
    n_int32 = n_scale // 4
    print("  一行 %d 个数 → %d 个 scale → %d 个 int32（= d/128 = %d）"
          % (D, n_scale, n_int32, D // 128))
    print("  一次 32 位读取拿到 4 把尺子，正好覆盖 128 个数。")
    print("  打包不是为了省空间（8 位本来就不浪费），是为了让 TMA 一次搬完。")
    print("  一行的尺子字节数：%d B" % (n_int32 * 4))

    print()
    print("三、对齐")
    for bm in (32, 64, 128):
        pad = (bm + 127) // 128 * 128
        print("  block_m=%3d → 垫到 %3d，空 %3d 行（%.0f%%）"
              % (bm, pad, pad - bm, (pad - bm) / pad * 100))
    print("  尺子的分块边界必须和 TMA / tile 尺寸对齐，否则读出来的不是那一组的尺子。")

    print()
    print("四、同样一段 KV，scale 读取次数的差别")
    for group in (32, 16):
        reads = 1024 // group
        print("  %d 个 token、per-%d：%d 次 scale 读取" % (1024, group, reads))
    print("  粒度细一倍，读取次数翻倍 —— 这也是实打实的带宽，不是免费的精度。")

    assert abs(a - 4.25) < 1e-9 and abs(b - 4.50) < 1e-9
    assert abs(bits_per_elem(8, 128) - 8.0625) < 1e-9
    assert abs((b / a - 1) * 100 - 5.88) < 0.01
    assert D // 128 == 56
    print("\n[自检] 4.25 / 4.50 / 8.06、多付 5.9%、d/128 = 56 —— 与动画一致")


if __name__ == "__main__":
    main()
