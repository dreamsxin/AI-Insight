#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-10 专家也会堵车

对应动画：docs/inf-10-eplb-animation.html

MoE 的瓶颈不在平均负载，在最慢的那张卡。这一份算：
  1. moe_lb = 最慢 rank / 平均，以及「干等」的两种口径
  2. 加冗余副本能把 moe_lb 压到多少，显存代价是什么
  3. 为什么 prefill 和 decode 的统计窗口差一个量级
  4. 三层均衡做完之后，还剩多少不均衡

    python examples/anim-demos/inf-10-eplb.py
"""
RANKS = (0.84, 0.87, 0.98, 0.91)     # 四个 rank 的归一化步时间（动画里的四根柱）
EXPERTS = 256                         # 路由专家总数（DeepSeek-V3 系）
REDUNDANT = {                         # 动画 06 节：每卡冗余专家数
    "prefill": (4, 4),                # EP4DP4 / EP2DP2 → EP4
    "decode": (64, 1),                # EP64 → 每卡 1 个
}


def lb(times):
    """moe_lb = 最慢 rank / 平均。"""
    return max(times) / (sum(times) / len(times))


def main():
    print("一、木桶：一步的时间由最慢的 rank 决定")
    for i, t in enumerate(RANKS):
        mark = "  ← 最慢，整步卡在这" if t == max(RANKS) else ""
        print("  rank %d  %.2f%s" % (i, t, mark))
    mean, top = sum(RANKS) / len(RANKS), max(RANKS)
    print("  平均 %.3f，最慢 %.2f" % (mean, top))
    print("  moe_lb = %.2f / %.3f = %.4f → 报为 1.09" % (top, mean, lb(RANKS)))
    print()
    print("  「干等」有两种口径，别混：")
    print("    最慢相对平均：moe_lb − 1 = %.1f%%   ← 动画说的「9%%」" % ((lb(RANKS) - 1) * 100))
    print("    整步算力浪费：1 − 平均/最慢 = %.1f%%   ← 实际空转的比例" % ((1 - mean / top) * 100))
    print("  两个数不一样，是因为分母不同（平均 vs 最慢）。量级都在 8~9%。")

    print()
    print("二、冗余副本：用显存把超额砍掉")
    print("  模型：热专家有 r 份副本、分散到 r 张卡，它带来的超额负载变成 1/r。")
    print("  moe_lb(r) ≈ 1 + (moe_lb − 1) / r")
    for r in (1, 2, 5):
        v = 1 + (lb(RANKS) - 1) / r
        print("    r=%d → moe_lb %.3f，超额 %.1f%%" % (r, v, (v - 1) * 100))
    print("  实测落点 1.074 / 1.045 / 1.090，和这条趋势同一量级；")
    print("  真值只能实测，「除以 r」是解释趋势用的，不是能算准的公式。")

    print()
    print("三、显存换均衡，值不值")
    for stage, (ep, red) in REDUNDANT.items():
        per_rank = EXPERTS // ep
        r = 1 + red
        mem_card = red / per_rank * 100
        mem_pool = red / EXPERTS * 100
        gain = (1 - (1 + (lb(RANKS) - 1) / r) / lb(RANKS)) * 100
        print("  %-8s EP%-3d 每卡 %2d 个专家 + %d 个副本" % (stage, ep, per_rank, red))
        print("           相对每卡专家权重 +%.1f%%，相对整个专家池 +%.1f%%"
              % (mem_card, mem_pool))
        print("           moe_lb %.3f → %.3f，步时间 −%.1f%%"
              % (lb(RANKS), 1 + (lb(RANKS) - 1) / r, gain))
    print("  看「每卡」会觉得 decode 贵（+25%），看「全池」才知道它只多 0.4% ——")
    print("  EP64 把专家摊到 64 张卡，一张卡本来就没几个，多一个的绝对量很小。")
    print("  prefill 反过来：每卡 64 个专家，加 4 个只是 +6.2%，")
    print("  但它要 5 份才能把超额压到 1.8% —— EP 小、卡少，均衡更难。")

    print()
    print("四、窗口和周期：两段差一个量级")
    for stage, win, per in (("prefill", 100, 1000), ("decode", 1000, 10000)):
        print("  %-8s 统计窗口 %5d 步，重排周期 %6d 步 → 每个周期 %d 个窗口"
              % (stage, win, per, per // win))
    print("  两段的绝对参数差 10 倍，但「攒 10 个窗口再洗一次牌」是一样的 ——")
    print("  差的是负载变化的速度：prefill 大 batch 突发、抖；decode 每步一小撮、慢变。")

    print()
    print("五、三层均衡做完，还剩多少")
    print("  专家层 1.09，再叠 prefill 分桶 / decode 双维度 / VE 挑卡三层。")
    print("  效果是「消掉约 80% 的超额」，不是「归零」：")
    left = 1 + (lb(RANKS) - 1) * 0.2
    print("    moe_lb %.3f → %.3f，干等 %.1f%% → %.1f%%"
          % (lb(RANKS), left, (1 - mean / top) * 100, (left - 1) * 100))
    print("  剩下的 20% 不是没做好，是与真实流量搏斗的固定成本 —— 在线没有先知。")

    assert abs(lb(RANKS) - 1.09) < 0.005
    assert abs((1 - mean / top) * 100 - 8) < 0.5
    assert 1000 // 100 == 10 and 10000 // 1000 == 10
    assert abs(left - 1.018) < 0.002
    print("\n[自检] moe_lb 1.09、干等 8%、两段窗口都是 10 个 —— 与动画一致")


if __name__ == "__main__":
    main()
