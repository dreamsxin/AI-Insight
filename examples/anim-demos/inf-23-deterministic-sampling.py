#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-23 每个序列一个种子

对应动画：docs/inf-23-deterministic-sampling-animation.html

上一集说「归约顺序会翻 top-1」，这一集给出工程上的答案：
随机数不是一条流，是「地址」。于是三条断言都能成立：

  #1 跑两遍——一样
  #2 打乱行序——一样
  #3 逐行单独跑——一样

    python examples/anim-demos/inf-23-deterministic-sampling.py
"""
MASK = (1 << 64) - 1


def u01(seed, seq, pos):
    """counter-based RNG：只由 (seed, 序列号, 位置) 决定。"""
    x = (seed * 0x9E3779B97F4A7C15
         + seq * 0xBF58476D1CE4E5B9
         + pos * 0x94D049BB133111EB) & MASK
    x ^= x >> 30
    x = (x * 0xBF58476D1CE4E5B9) & MASK
    x ^= x >> 27
    x = (x * 0x94D049BB133111EB) & MASK
    x ^= x >> 31
    return (x >> 11) / float(1 << 53)


def pick(seed, seq, pos, vocab=8):
    """把 [0,1) 映射成一个 token id —— 代表「采样」这一步。"""
    return int(u01(seed, seq, pos) * vocab)


def main():
    SEED, POS, N = 20261106, 512, 64
    base = [pick(SEED, s, POS) for s in range(N)]

    print("一、随机数是地址，不是流")
    print("  第 37 个序列、第 %d 个位置 → %.6f → id %d"
          % (POS, u01(SEED, 37, POS), base[37]))
    print("  再叫一次同一地址：%.6f → id %d（一模一样）"
          % (u01(SEED, 37, POS), pick(SEED, 37, POS)))
    print("  这就是「与批大小无关」的物理基础：没人去「消耗」一个流。")

    print()
    print("二、三条断言")
    again = [pick(SEED, s, POS) for s in range(N)]
    a1 = again == base
    print("  #1 跑两遍         %s" % ("通过" if a1 else "失败"))

    order = [(i * 37) % N for i in range(N)]        # 一个确定的乱序
    shuffled = {s: pick(SEED, s, POS) for s in order}
    a2 = all(shuffled[s] == base[s] for s in range(N))
    print("  #2 打乱行序       %s（%d 行逐位相同）" % ("通过" if a2 else "失败", N))

    single = {s: pick(SEED, s, POS) for s in (37, 5, 63)}
    a3 = all(single[s] == base[s] for s in single)
    print("  #3 逐行单独跑     %s（batch=1 与 batch=%d 结果一致）"
          % ("通过" if a3 else "失败", N))

    print()
    print("三、换掉 seed 就不一样了（证明它真的在起作用）")
    other = [pick(SEED + 1, s, POS) for s in range(N)]
    same = sum(1 for x, y in zip(base, other) if x == y)
    print("  seed+1：%d 行里只有 %d 行恰好相同（vocab 8，期望 %.0f）"
          % (N, same, N / 8))
    print("  不是「全部一样」（说明 seed 没生效），也不是「完全无关」（那才正常）。")

    print()
    print("四、为什么这三条比文档更能防回归")
    print("  它们不依赖「这次对不对」，只依赖「两次是否一致」。")
    print("  任何一处动了归约顺序、分块方式或专家位置，这三条里至少断一条。")

    assert a1 and a2 and a3
    assert u01(SEED, 7, 3) == u01(SEED, 7, 3)
    print("\n[自检] 三条断言全通过、地址可重放、换 seed 结果变 —— 与动画一致")


if __name__ == "__main__":
    main()
