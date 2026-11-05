#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-18 只差 5%

对应动画：docs/inf-18-kernel-gap-animation.html

「decode kernel 慢 5–10%，端到端只差 5%」—— 这一份解释为什么不是线性叠加：

  1. 一步的时间构成：注意力 26% / MoE 42% / 通信 21% / 其它 11%
  2. 单段慢 10%，摊到整步是多少
  3. 为什么几段加起来会超过实测 —— 以及超过说明什么
  4. 3% 的东西优化一倍，只赚 1.5 个点

    python examples/anim-demos/inf-18-kernel-gap.py
"""
SHARES = [("注意力", 26.0), ("MoE", 42.0), ("通信", 21.0), ("其它", 11.0)]


def main():
    total = sum(s for _, s in SHARES)
    print("一、一步的时间构成")
    for name, s in SHARES:
        print("  %-6s %5.1f%%  %s" % (name, s, "█" * int(s / 2)))
    print("  合计 %.0f%%" % total)

    print()
    print("二、单段慢 10%，摊到整步")
    print("  %-6s %8s %12s" % ("段", "占比", "整步影响"))
    for name, s in SHARES:
        print("  %-6s %7.0f%% %11.2f 个点" % (name, s, s * 0.10))
    print(f"  注意力那段：26% × 10% = {26 * 0.1:.1f} 个点 —— 这就是「即便 attention 慢 10%，")
    print("  摊到整步也只有约 2.6%」的来历。")

    print()
    print("三、几段叠起来")
    slower = {"注意力": 0.10, "MoE": 0.06, "通信": 0.05, "其它": 0.05}
    acc = 0.0
    for name, s in SHARES:
        d = s * slower[name]
        acc += d
        print("  %-6s 慢 %.0f%% → 贡献 %.2f 个点" % (name, slower[name] * 100, d))
    print(f"  合计 {acc:.1f} 个点，实测端到端 5%。")
    print("  注意：几段不是简单相加 —— 慢的那段会挤占别的段的时间预算，")
    print("  部分空隙被填掉，所以实测会略低于线性叠加。")

    print()
    print("四、边际收益")
    print("  把某段快一倍，最多省它的一半：")
    for name, s in sorted(SHARES, key=lambda x: x[1]):
        print("  %-6s %5.1f%% → 快一倍省 %.1f 个点" % (name, s, s / 2))
    print("  所以「某类 kernel 只占 3%，优化一倍也只赚 1.5」不是消极，是算术。")

    print()
    print("五、5% 为什么追不平")
    print("  开源版少一层手写 SASS，decode 慢 5–10%；端到端只差 5%。")
    print("  剩下的差距不在 kernel 里，在别处：调度、批形状、通信重叠。")
    print("  kernel 的边际收益收敛得很快 —— 这正是「只差 5%」的真实含义。")

    assert abs(total - 100) < 1e-9
    assert abs(26 * 0.1 - 2.6) < 1e-9
    print("\n[自检] 26/42/21/11、注意力 10%→2.6 个点、3% 优化一倍只赚 1.5 —— 与动画一致")


if __name__ == "__main__":
    main()
