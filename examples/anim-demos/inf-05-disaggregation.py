#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-05 拆开才跑得快

对应动画：docs/inf-05-disaggregation-animation.html

prefill 取最小、decode 取最宽 —— 这一份算三件事：
  1. 为什么 prefill 用 EP2–8、decode 用 EP64–128
  2. 1P:1D 是怎么来的，最小高效部署单元为什么是 64+64
  3. E/P/D 之间传的那点 KV，到底多大

    python examples/anim-demos/inf-05-disaggregation.py
"""
N_EXPERTS = 256
HIDDEN = 7168
BYTES = 2
KV_PER_TOKEN = 528        # MXFP8 时每 token 每份 cache（见 inf-30）
COPIES = 3


def per_card_experts(ep):
    return N_EXPERTS / ep


def main():
    print("一、两段需要的不是同一种东西")
    print("  prefill：算力密集，一次算一大片 —— 卡少但要能吃满算力")
    print("  decode ：带宽密集，每步都要把所有专家过一遍 —— 卡多才摊得薄")
    print()
    print("  %4s %12s %14s" % ("EP", "每卡专家数", "每步搬的权重"))
    for ep in (2, 4, 8, 16, 64, 128):
        per = per_card_experts(ep)
        w = per * HIDDEN * 2 * BYTES / 1e9        # 粗算：每个专家的两张矩阵
        print("  %4d %12.1f %13.1f GB" % (ep, per, w))
    print("  EP 越大，每卡守的专家越少，每步要搬的权重越薄 —— decode 要的正是这个。")

    print()
    print("二、为什么扩容有代价")
    print("  从 EP8 到 EP64：一次 all-to-all 的路更长，参与方更多，更容易堵。")
    print("  而且 64 卡是一个通信域 —— 一张卡挂了，整个实例不可用（见 inf-21）。")
    print("  所以 prefill 停在 EP2–8，不跟着往上扩。")

    print()
    print("三、1 : 1 是怎么来的")
    print("  一个请求的一生：prefill 一次算完 prompt，decode 逐字吐出来。")
    p_tokens, out_tokens = 4096, 500
    print("  假设 prompt %d token、输出 %d token" % (p_tokens, out_tokens))
    print("  prefill 的活 = %d token 的前向（一次）" % p_tokens)
    print("  decode 的活  = %d 步，每步一批" % out_tokens)
    print("  两边的卡数大致 1:1，是因为「一次算 4096 个」和「算 500 步」在实机上耗时相当。")
    print("  这只是量级结论，不是定律 —— 长输出场景 D 会更多，短问答 P 会更多。")

    print()
    print("四、搬过去的那点 KV")
    kv = p_tokens * KV_PER_TOKEN * COPIES
    print("  %d token × %d B × %d 份 = %.1f MB / 请求"
          % (p_tokens, KV_PER_TOKEN, COPIES, kv / 2**20))
    print("  按每卡 6.25 GB/s（6250 MB/s）：%.1f ms 传完 —— 比重新算一遍 prefill 便宜得多。"
          % (kv / 2**20 / 6250 * 1000))
    print("  所以 KV 被压得很小之后，P 与 D 甚至可以分处相邻机房。")

    print()
    print("五、最小高效部署单元")
    print("  不是 1 台机器，而是「64 卡 prefill + 64 卡 decode」——")
    print("  因为它要同时满足：decode 的 EP 宽度、prefill 的算力密度、一个通信域。")

    assert per_card_experts(64) == 4
    assert abs(KV_PER_TOKEN * 4096 * 3 / 2**20 - 6.18) < 0.05
    print("\n[自检] EP64 → 每卡 4 专家、4K prompt 的 KV ≈ 6.2 MB —— 与动画一致")


if __name__ == "__main__":
    main()
