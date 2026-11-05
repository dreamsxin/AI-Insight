#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-04 两种性格的机器

对应动画：docs/inf-04-two-phase-animation.html

prefill 饿算力、decode 饿带宽 —— 这一份用算术强度把话说清楚：
  1. 算术强度 = 做了多少 flop / 搬了多少字节
  2. 机器的「平衡点」在哪（算力 ÷ 带宽）
  3. 为什么 decode 加 batch 几乎不增加时间，而 prefill 是线性涨

    python examples/anim-demos/inf-04-two-phase.py
"""
N_PARAMS = 37e9        # 激活参数（MoE 每次只算这一部分）
BYTES = 2              # bf16
TFLOPS = 989.0         # bf16 峰值
BW_GBS = 3350.0        # HBM 带宽 GB/s


def balance():
    return TFLOPS * 1e12 / (BW_GBS * 1e9)      # flop / byte


def phase(tokens, batch=1):
    """一次前向：算多少 flop、搬多少字节。"""
    flops = 2 * N_PARAMS * tokens * batch
    moved = N_PARAMS * BYTES                   # 权重至少过一遍
    return flops, moved


def main():
    b = balance()
    print("一、机器的平衡点")
    print("  %.0f TFLOPS ÷ %.0f GB/s = %.0f flop/byte" % (TFLOPS, BW_GBS, b))
    print("  算术强度高于这个数 → 算力是瓶颈；低于它 → 带宽是瓶颈。")

    print()
    print("二、两个阶段的算术强度")
    print("  %-22s %10s %12s %10s" % ("场景", "token·batch", "强度", "结论"))
    for name, tokens, batch in (
        ("prefill 4096", 4096, 1),
        ("prefill 32768", 32768, 1),
        ("decode batch 1", 1, 1),
        ("decode batch 60", 1, 60),
        ("decode batch 256", 1, 256),
    ):
        f, m = phase(tokens, batch)
        inten = f / m
        print("  %-22s %10d %12.0f %10s"
              % (name, tokens * batch, inten, "算力" if inten > b else "带宽"))

    print()
    print("三、时间是怎么长的")
    t_bw = N_PARAMS * BYTES / (BW_GBS * 1e9)
    print("  权重过一遍的最短时间 = %.1f GB / %.0f GB/s = %.2f ms"
          % (N_PARAMS * BYTES / 1e9, BW_GBS, t_bw * 1000))
    for batch in (1, 8, 60):
        f, m = phase(1, batch)
        t_compute = f / (TFLOPS * 1e12)
        print("  decode batch %3d：搬运 %.2f ms，计算 %.2f ms → 取大的那个 %.2f ms"
              % (batch, t_bw * 1000, t_compute * 1000, max(t_bw, t_compute) * 1000))
    print("  batch 从 1 涨到 60，时间几乎不变 —— 因为带宽没变，而算力还没吃满。")
    print("  这就是「8 个请求拼成一批，一次搬运摊给 8 个 token」。")

    print()
    print("四、两句话记住")
    print("  prefill：算力不够，加卡有用，堆 batch 没用（它已经很大了）。")
    print("  decode ：带宽不够，堆 batch 有用，加算力几乎白加。")

    assert abs(b - 295.2) < 1.0
    assert phase(4096, 1)[0] / phase(4096, 1)[1] > b > phase(1, 60)[0] / phase(1, 60)[1]
    print("\n[自检] 平衡点 ≈ 295、prefill 算力瓶颈、decode 带宽瓶颈 —— 与动画一致")


if __name__ == "__main__":
    main()
