#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-26 k 越大越好看

对应动画：docs/inf-26-pass-at-k-animation.html

同一批 rollout，模型一次没重跑，分数却能一路算到 100。
这一份把公式跑一遍，验证四件事：

  1. k = 1 时公式退化成「平均对率」，两者是同一件事
  2. c = 1（32 次只对 1 次）时，pass@k 恰好等于 k / 32
  3. 反向的边界：c = 31（只错 1 条）时，k = 8 就已经必过
  4. 只报 k 不报 n，等于什么都没说

    python examples/anim-demos/inf-26-pass-at-k.py
"""
from math import comb


def pass_at_k(n, c, k):
    """无偏估计：1 - C(n-c,k)/C(n,k)。

    n 每题采样数，c 其中答对的次数，k 要看前 k 个。
    n-c < k 时组合数按 0 处理，结果正好是 1.0。
    """
    if k > n:
        return None                      # 抽不出 k 个，不该问
    if n - c < k:
        return 1.0                       # 剩下的可抽样本全是错的 → 必抽到对的
    return 1.0 - comb(n - c, k) / comb(n, k)


def main():
    print("一、k = 1 的退化")
    print("  n=32, c=31 → c/n = %.4f, pass@1 = %.4f" % (31 / 32, pass_at_k(32, 31, 1)))
    print("  C(n-1,1)/C(n,1) 就是 (n-c)/n，1 减它正好是 c/n。")
    print("  → Pass@1 和「平均对率」是同一件事的两个名字。")

    print()
    print("二、32 次里只对 1 次（n=32, c=1）：k 越大越好看")
    print("  %5s %9s %9s %s" % ("k", "pass@k", "≈ k/32", "多出来的是什么"))
    for k in (1, 4, 16, 32):
        v = pass_at_k(32, 1, k)
        note = "模型本身" if k == 1 else "多抽几次的运气"
        print("  %5d %8.1f%% %8.1f%% %s" % (k, v * 100, k / 32 * 100, note))
    print("  c=1 时 1 - C(31,k)/C(32,k) = 1 - (32-k)/32 = k/32，严格相等。")
    print("  读法不变、模型不变，3.1 就变成了 100。")

    print()
    print("三、反向的边界：只错 1 条（n=32, c=31）")
    print("  %5s %9s %s" % ("k", "pass@k", "说明"))
    for k in (1, 8, 16):
        v = pass_at_k(32, 31, k)
        print("  %5d %8.1f%% %s" % (k, v * 100, "平均对率" if k == 1 else "错 1 条 < k，必过"))
    print("  同一个公式，c 大时很快就饱和 —— 饱和点由「错的条数」决定，不由 k 决定。")

    print()
    print("四、只报 k 不报 n 会怎样")
    cases = [("A 模型", 1, 1), ("B 模型", 32, 32), ("C 模型", 8, 8)]
    print("  %-7s %3s %3s %9s %9s" % ("", "n", "c", "pass@1", "pass@8"))
    for name, n, c in cases:
        p1 = pass_at_k(n, c, 1)
        p8 = pass_at_k(n, c, 8) if n >= 8 else None
        print("  %-7s %3d %3d %8.1f%% %9s"
              % (name, n, c, p1 * 100, "-" if p8 is None else "%.1f%%" % (p8 * 100)))
    print("  三行 pass@1 都是 100%，但 B 用了 32 次采样，A 只用了 1 次。")
    print("  所以报 Pass@k 必须连报 k 和 n —— 缺一个就无法比较。")

    print()
    print("五、缺样本时用 min(k, n)，不要丢题")
    n, c = 8, 7
    for k in (4, 8, 9):
        v = pass_at_k(n, c, k)
        print("  n=%d c=%d k=%d → %s" % (n, c, k, "None（抽不出）" if v is None else "%.4f" % v))
    print("  丢掉这种题会把分母里最难的部分删掉，剩下的平均分自然好看。")

    assert abs(pass_at_k(32, 31, 1) - 31 / 32) < 1e-12       # k=1 退化为 c/n
    assert abs(pass_at_k(32, 1, 16) - 0.5) < 1e-12           # c=1 时恰好 k/32
    assert pass_at_k(32, 31, 8) == 1.0                       # 错 1 条，k=8 必过
    assert pass_at_k(32, 31, 32) == 1.0
    print("\n[自检] k=1 退化为 c/n、c=1 时等于 k/32、c=31 时 k=8 必过 —— 与动画一致")


if __name__ == "__main__":
    main()
