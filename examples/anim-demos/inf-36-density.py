#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-36 一格能装多少

对应动画：docs/inf-36-density-animation.html

密度这件事，四笔账都能算：
  1. state slot 为什么是「比例 + 1」
  2. 每 token 528 B 对 32 B 对齐，零头有多大
  3. 3FS 的容量：20 块盘、10+2 纠删、每卡 14.4 TB
  4. 带宽：一块 400 Gbps 网卡分给 8 张卡，每张多少

    python examples/anim-demos/inf-36-density.py
"""
from math import gcd

PER_TOKEN = 528       # MXFP8 时每 token 每份 cache 的字节数
ALIGN = 32
LAYERS = 61
COPIES = 3
MAX_SEQS = 1200
RATIO = 0.25

DISK_TB = 30.73
N_DISK = 20
DATA, PARITY = 10, 2
PER_GPU_TB = 14.4
NIC_GBPS = 400
GPUS_PER_NIC = 8


def main():
    print("一、state slot 为什么 +1")
    slots = int(MAX_SEQS * RATIO) + 1
    print("  int(%d × %.2f) + 1 = %d" % (MAX_SEQS, RATIO, slots))
    print("  比例那部分是「按并发配的格子」，+1 给「正在写入但还没登记」的那一路。")
    print("  不加这 1：满载时最后一路会踩到别人的格子 —— 表现为随机串话，极难复现。")

    print()
    print("二、对齐的零头")
    lcm = PER_TOKEN * ALIGN // gcd(PER_TOKEN, ALIGN)
    print("  每 token %d B，按 %d B 对齐 → lcm = %d B（%d 个 token 一组）"
          % (PER_TOKEN, ALIGN, lcm, lcm // PER_TOKEN))
    print("  偶数长度恰好整除；奇数长度每层每份都要补 %d B。" % (lcm - PER_TOKEN))
    print()
    print("  %8s %10s %10s %10s" % ("token", "本层本份", "垫后", "零头"))
    for tokens in (1000, 1001, 4095):
        raw = tokens * PER_TOKEN
        padded = (raw + lcm - 1) // lcm * lcm
        print("  %8d %8d B %8d B %8d B" % (tokens, raw, padded, padded - raw))
    print()
    print("  单看一条请求，零头只有几百字节，忽略不算错；")
    odd = 1001
    waste_one = ((odd * PER_TOKEN + lcm - 1) // lcm * lcm) - odd * PER_TOKEN
    conc = 2000
    total = waste_one * LAYERS * COPIES * conc
    print("  但 cache 是「每层每份单独分配」的：%d B × %d 层 × %d 份 × %d 并发 = %.0f MB"
          % (waste_one, LAYERS, COPIES, conc, total / 2**20))
    print("  全是奇数长度时，这部分是白占的 —— 所以容量规划要按垫齐后的格子数算。")

    print("三、3FS 的容量")
    raw = N_DISK * DISK_TB
    usable = raw * DATA / (DATA + PARITY)
    print("  %d × %.2f TB = %.1f TB 物理" % (N_DISK, DISK_TB, raw))
    print("  纠删 %d+%d → 只有 %.1f TB 可用（%d 份盘出 %d 份容量）"
          % (DATA, PARITY, usable, DATA + PARITY, DATA))
    print("  每卡 %.1f TB → 够 %.1f 张卡" % (PER_GPU_TB, usable / PER_GPU_TB))
    print("  这决定了一个集群能开多少 decode 实例 —— 不是显存不够，是盘先到顶。")

    print()
    print("四、带宽")
    per_gpu = NIC_GBPS / GPUS_PER_NIC / 8
    print("  %.0f Gbps ÷ %d 卡 ÷ 8 = %.2f GB/s 每卡" % (NIC_GBPS, GPUS_PER_NIC, per_gpu))
    print("  一次 100 MB 的 KV 换出要 %.0f ms —— 这就是「KV 外置」的隐性成本。"
          % (100 / 1024 / per_gpu * 1000))
    print("  顺序读 ≥40 GB/s 是说整机，不是说你那张卡能拿到 40。")

    print()
    print("五、四个数字各有各的主")
    print("  分数  ← 由采样数 n 决定（inf-25/26）")
    print("  长度  ← 由每 token 字节数决定（inf-30）")
    print("  时延  ← 由发射次数与桶粒度决定（inf-31/33）")
    print("  密度  ← 由对齐、纠删、网卡分配决定（本集）")

    assert slots == 301
    assert lcm == 1056
    assert abs(usable - 512.2) < 0.2
    print("\n[自检] 301 个 slot、lcm 1056、可用 512 TB、每卡 6.25 GB/s —— 与动画一致")


if __name__ == "__main__":
    main()
