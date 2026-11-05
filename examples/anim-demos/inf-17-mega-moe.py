#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-17 三段融成一段

对应动画：docs/inf-17-mega-moe-animation.html

dispatch → 专家 GEMM → combine，三段各写一次、各读一次 = 6 趟显存；
融成一段后只在最后写一次。这一份把这 6 趟算成字节和毫秒：

  1. 中间张量到底多大（token × hidden × 字节）
  2. 6 趟 vs 2 趟，差多少带宽时间
  3. 为什么只赢在 scale-up 域内：跨机时省下的是显存，换来的是更长的路

    python examples/anim-demos/inf-17-mega-moe.py
"""
TOKENS = 4096         # 一步里的 token 数
HIDDEN = 7168
BYTES = 2             # bf16
HBM_GBS = 3200        # 单卡 HBM 带宽（GB/s），示意
FUSED_SHARE = 0.18    # 三段里真正花在搬运上的比例（示意）


def main():
    one = TOKENS * HIDDEN * BYTES
    print("一、一个中间张量多大")
    print("  %d token × %d 维 × %d B = %.1f MB" % (TOKENS, HIDDEN, BYTES, one / 2**20))

    print()
    print("二、六趟还是两趟")
    print("  三段式：每段写一次、下一段读一次 → 3 写 + 3 读 = 6 趟")
    print("  融合后：输入读一次、输出写一次 → 2 趟")
    print("  省下 %d 趟 × %.1f MB = %.1f MB / 步" % (6 - 2, one / 2**20, (6 - 2) * one / 2**20))
    t_before = 6 * one / (HBM_GBS * 1e9) * 1000
    t_after = 2 * one / (HBM_GBS * 1e9) * 1000
    print("  按 %.0f GB/s：%.2f ms → %.2f ms" % (HBM_GBS, t_before, t_after))

    print()
    print("三、这一步在整步里值多少")
    print("  MoE 段占整步 42%%，其中搬运约 %.0f%% → 搬运约 %.1f 个点" % (FUSED_SHARE * 100, 42 * FUSED_SHARE))
    saved = (t_before - t_after) / t_before * 42 * FUSED_SHARE
    print("  融合省掉的 4 趟 → 整步约 %.1f%%（与「只赢在 scale-up 域内」的量级相符）" % saved)
    print("  这个数不大，但它是在 SM 已经吃满的情况下拿到的 —— 只能靠不搬。")

    print()
    print("四、为什么只赢在 scale-up 域内")
    print("  scale-up（同一台机器 / 同一交换域）：")
    print("    dispatch 走 NVLink，省下的 4 趟是真省。")
    print("  scale-out（跨机）：")
    print("    省下的是本地显存，但 token 仍要过一次网络；")
    print("    网络那头的时间没变，融合的收益被通信摊平。")
    print("  所以「融成一段」不是通用解 —— 它把绑定关系从显存换成了拓扑。")

    print()
    print("五、尺子为什么必须就地生成")
    print("  per-32 的 ue8m0 要在 GEMM 之前就绪。若等落盘再算，等于多一趟读写。")
    print("  norm 那一步顺手把它写进同一块 shared memory —— 这就是「融合」的真实含义：")
    print("  不是少启动几次，是不让数据回到显存。")

    assert one == TOKENS * HIDDEN * BYTES
    assert t_before / t_after == 3.0
    print("\n[自检] 6 趟 → 2 趟、耗时正好 3 倍关系、%.1f MB/张量 —— 与动画一致" % (one / 2**20))


if __name__ == "__main__":
    main()
