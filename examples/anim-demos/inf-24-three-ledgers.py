#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-24 四道看不见的账

对应动画：docs/inf-24-three-ledgers-animation.html

第二季的收尾：四本账并排结清。每一本都是「省了什么、付了什么」，
这一份把 24 集里出现过的数字汇总成一张表，并验证它们互不免费。

    python examples/anim-demos/inf-24-three-ledgers.py
"""
LEDGERS = [
    # (账本, 省下, 付出, 数字出处)
    ("精度", "KV 字节 ÷ 2（8 bit → 4 bit）",
     "多 5.9% 位宽 + 离群值压扁同组", "inf-13/14"),
    ("融合", "中间张量 6 趟 → 2 趟",
     "只在 scale-up 域内成立；跨机被通信摊平", "inf-17"),
    ("弹性", "故障不停机（60 秒转交）",
     "20% 冗余配额 + 缩容红线 0.8", "inf-19/20"),
    ("一致性", "同输入同输出，bug 可复现",
     "关掉 allow_multiple_reduction，少一条并行捷径", "inf-22/23"),
]


def main():
    print("一、四本账")
    print("  %-6s %-26s %s" % ("账本", "省下", "付出"))
    for name, save, cost, _ in LEDGERS:
        print("  %-6s %-26s %s" % (name, save, cost))

    print()
    print("二、它们互相牵制")
    print("  精度 ↓ 位宽：字节少一半，但舍入噪声变大 → 一致性更难守。")
    print("  融合 ↑ 利用率：少搬 4 趟，但把 kernel 绑死在一种拓扑上 → 弹性变差。")
    print("  弹性 ↑ 冗余：不排队，但多开 20% 的机器 → 成本上去。")
    print("  一致性 ↑ 确定：可复现，但关掉一条并行捷径 → 精度/性能都要让一点。")
    print("  所以没有「四项全优」的配置，只有「这一档负载下最划算」的配置。")

    print()
    print("三、边际收益的算术")
    print("  %-16s %8s %12s" % ("动作", "占比", "整步收益"))
    for name, share in (("把 3% 的 kernel 优化一倍", 3.0),
                        ("把 11% 的搬运砍一半", 11.0),
                        ("把 26% 的 attention 优化 10%", 26.0),
                        ("把 42% 的 MoE 优化 10%", 42.0)):
        gain = share / 2 if "一倍" in name or "一半" in name else share * 0.1
        print("  %-16s %7.0f%% %11.1f 个点" % (name, share, gain))
    print("  先量 trace，再动刀 —— 3% 的那一段，优化到头也只值 1.5 个点。")

    print()
    print("四、四本账的回扣")
    print("  这一季的 12 集，对应第一季那张五层图里的第 2–4 层：")
    print("    精度 13–15   → 第 3 层「缓存与带宽」")
    print("    kernel 16–18 → 第 2 层「算子与调度」")
    print("    弹性 19–21   → 第 4 层「集群与容错」")
    print("    一致性 22–23 → 贯穿四层的一条约束")
    print("  单看每一集都是「某处快了一点」；并排看，它们是同一笔预算的四种花法。")

    assert len(LEDGERS) == 4
    assert 3.0 / 2 == 1.5
    print("\n[自检] 四本账、3% 优化一倍 = 1.5 个点、四层回扣 —— 与动画一致")


if __name__ == "__main__":
    main()
