#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-07 缓存金字塔

对应动画：docs/inf-07-kv-tier-animation.html

三级 KV：显存 / 主机内存 / 3FS。命中哪一级，决定了首字要等多久。
这一份算：

  1. 每一级的单次读取代价（按 128 token 一块）
  2. 混合命中率下的平均首字延迟
  3. TTL 从 7 天砍到 3 天，真实代价是多少

    python examples/anim-demos/inf-07-kv-tier.py
"""
import math

BLOCK = 128          # 一块 128 token
TIERS = [
    ("显存 HBM", 0.002, "常驻，命中就直接算"),
    ("主机内存", 0.020, "要过一次 PCIe"),
    ("3FS",      2.000, "要过一次网络 + 一次盘"),
]


def main():
    print("一、三级的代价（读一块 %d token 的 KV）" % BLOCK)
    print("  %-10s %10s  %s" % ("层级", "单块耗时", "多出来的是什么"))
    for name, ms, why in TIERS:
        print("  %-10s %8.2f ms  %s" % (name, ms, why))
    print("  HBM 到 3FS 差 %.0f 倍 —— 这就是为什么「命中率」比「容量」更值得盯。"
          % (2.0 / 0.002))

    print()
    print("二、一个 4K 的 prompt 要读几块")
    blocks = 4096 // BLOCK
    print("  4096 token ÷ %d = %d 块" % (BLOCK, blocks))
    print("  %-10s %12s" % ("全在", "首字延迟"))
    for name, ms, _ in TIERS:
        print("  %-10s %10.1f ms" % (name, blocks * ms))
    print("  全命中显存 = 首字几乎不额外花时间；全落 3FS = 秒级，用户能感觉到。")

    print()
    print("三、混合命中率下的平均值")
    print("  %-22s %12s %12s" % ("分布", "平均耗时", "相对全命中"))
    base = blocks * TIERS[0][1]
    for name, mix in (
        ("60/30/10", (0.6, 0.3, 0.1)),
        ("85/12/3", (0.85, 0.12, 0.03)),
        ("95/4/1", (0.95, 0.04, 0.01)),
    ):
        avg = blocks * sum(m * t[1] for m, t in zip(mix, TIERS))
        print("  %-22s %9.2f ms %11.1f×" % (name, avg, avg / base))
    print("  命中率从 60% 提到 95%，首字延迟差一个量级 —— 这比多买显存便宜。")

    print()
    print("四、TTL 的取舍")
    for ttl in (1, 3, 7, 30):
        hit = 0.995 - 0.06 * math.exp(-ttl / 1.5)     # 长尾指数衰减
        print("  TTL %2d 天 → 命中率约 %.1f%%" % (ttl, hit * 100))
    d3 = 0.995 - 0.06 * math.exp(-3 / 1.5)
    d7 = 0.995 - 0.06 * math.exp(-7 / 1.5)
    print("  7 天 → 3 天，命中率只掉 %.2f 个点；再往上加天数，长尾几乎不涨。"
          % ((d7 - d3) * 100))
    print("  所以 chatbot 用 3 天，agent 也用 3 天 —— 剩下的长尾不值得再付存储钱。")

    print()
    print("五、3FS 给了什么底气")
    print("  20 × 30.73 TB、10+2 纠删、顺序读 40 GB/s —— 每卡摊到十几 TB。")
    print("  这才敢「留 3 天」：不是盘便宜，是命中率曲线在 3 天之后已经平了。")

    assert blocks == 32
    assert abs(blocks * 2.0 - 64.0) < 1e-9
    print("\n[自检] 4K prompt = 32 块、全落 3FS = 64 ms、三级差 1000 倍 —— 与动画一致")


if __name__ == "__main__":
    main()
