#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-09 先猜，再验

对应动画：docs/inf-09-dspark-animation.html

固定猜 5 个，会让后面几个白验。这一份把「白验」算出来：
  1. 每个草稿位的接受概率递减 → 期望接受几个
  2. 白验比例 = 1 − 期望接受 / 验证位数
  3. 什么样的草稿模型才能把白验压到 30%

    python examples/anim-demos/inf-09-dspark.py
"""
FIXED = 5


def expected(p):
    """E[接受数] = Σ_i Π_{j<=i} p_j —— 前缀必须全对才算接受。"""
    total, run = 0.0, 1.0
    for pi in p:
        run *= pi
        total += run
    return total


def main():
    print("一、草稿位的接受概率递减")
    p = [0.82, 0.71, 0.58, 0.41, 0.27]
    for i, pi in enumerate(p, 1):
        print("  第 %d 个：%.2f" % (i, pi))
    print("  第 4、5 个已经很低 —— 但固定 5 意味着「不管难易，都验 5 个」。")

    print()
    print("二、期望接受几个")
    e = expected(p)
    terms, run = [], 1.0
    for pi in p:
        run *= pi
        terms.append(run)
    print("  E = %.2f + %.2f + %.2f + %.2f + %.2f = %.2f"
          % (terms[0], terms[1], terms[2], terms[3], terms[4], e))
    print("  每步产出约 %.1f 个 token（还要加 1 个验证后必然拿到的）" % e)
    print("  白验比例 = 1 − %.2f / %d = %.0f%%" % (e, FIXED, (1 - e / FIXED) * 100))
    print("  → 这套草稿太弱，固定 5 是纯浪费：一半以上的验证位空转。")

    print()
    print("三、好一点的草稿能到多少")
    good = [0.96, 0.92, 0.85, 0.75, 0.60]
    eg = expected(good)
    print("  接受概率 %s" % good)
    print("  E = %.2f，白验 = %.0f%%" % (eg, (1 - eg / FIXED) * 100))
    print("  这就是动画里「30% 白验」对应的那一档：草稿模型本身要够准。")

    print()
    print("四、为什么按难度变长")
    print("  固定 5：简单题浪费（本来 2 个就够），难题不够（5 个全废）。")
    print("  变长  ：按置信度打分决定验几个 —— 简单的验 2 个，难的验 8 个。")
    print("  收益曲线是「相对固定 5 的吞吐增益」：")
    for conc, gain in ((16, -1.5), (32, 2.0), (60, 5.5), (96, 11.0)):
        print("    %3d 并发 → %+5.1f%%" % (conc, gain))
    print("  低并发时反而更慢（打分本身要算力），高并发时省下的验证位变成吞吐。")

    print()
    print("五、还有一个工程细节")
    print("  排第 N+1 步时，第 N 步的置信度还没回到 CPU ——")
    print("  所以「按需变长」必须靠异步：先用上一轮的分数，晚一步也没关系。")

    assert abs(expected(p) - 1.92) < 0.01
    assert 0.45 < (1 - expected(p) / FIXED) < 0.65
    assert abs((1 - expected(good) / FIXED) * 100 - 30) < 3
    print("\n[自检] 弱草稿白验 ~62%、好草稿 ~30%、低并发会变慢 —— 与动画一致")


if __name__ == "__main__":
    main()
