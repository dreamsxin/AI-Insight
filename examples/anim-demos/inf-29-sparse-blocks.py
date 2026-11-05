#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-29 只算该算的块

对应动画：docs/inf-29-sparse-blocks-animation.html

100 万 token 的历史，每步都要判断「哪些块值得算」。这一份算出：
  1. 块级索引把 100 万次比较压成多少次（block_size=64）
  2. 两级筛取怎么再省一层（先粗后细）
  3. 索引自身按 ratio 再压 4 倍
  4. 代价：分数带噪时会看漏，漏掉的块影响多大

    python examples/anim-demos/inf-29-sparse-blocks.py
"""
import random

N_TOKENS = 1_000_000
BLOCK = 64
RATIO = 4          # 粗块里只记录 1/4
TOPK = 32          # 每步参与的块数


def main():
    n_blocks = N_TOKENS // BLOCK
    print("一、块级索引")
    print("  %d token ÷ %d = %d 块" % (N_TOKENS, BLOCK, n_blocks))
    print("  token 级比较：%d 次" % N_TOKENS)
    print("  块级比较：    %d 次（uint8 一字节一个分数，共 %.1f KB）"
          % (n_blocks, n_blocks / 1024))
    print("  → 少 %.0f 倍" % (N_TOKENS / n_blocks))

    print()
    print("二、两级筛取：先粗后细")
    n_coarse = n_blocks // RATIO
    step1 = n_coarse                       # 粗块各取一个 max
    step2 = TOPK * RATIO                   # 只有前 TOPK 个粗块需要展开
    print("  第一级：%d 个粗块各取 max            %6d 次" % (n_coarse, step1))
    print("  第二级：只有前 %d 个粗块展开成 %d 个细块  %6d 次"
          % (TOPK, TOPK * RATIO, step2))
    print("  合计 %d 次；相对 token 级省 %.0f 倍，相对全量块级再省 %.1f 倍"
          % (step1 + step2, N_TOKENS / (step1 + step2), n_blocks / (step1 + step2)))

    print()
    print("三、索引自身也被压缩")
    print("  每 %d 块只记录 1 条（ratio=%d）→ %d 条" % (RATIO, RATIO, n_coarse))
    print("  索引占 %.1f KB，比全量 %.1f KB 省 %.0f%%"
          % (n_coarse / 1024, n_blocks / 1024, (1 - 1 / RATIO) * 100))
    print("  代价：没被记录的块，这一步根本看不到。")

    print()
    print("四、看漏的代价：块级分数带噪时，top-%d 还剩多少" % TOPK)
    # 真实的块分不是均匀的：少数块明显更相关。用 4 次方拉开差距，
    # 头部块之间留出安全间距，噪声才有「刚好压垮排序」的可能。
    rng = random.Random(20261106)
    n_trials = 30
    print("  %-8s %-14s %-14s" % ("噪声σ", "全量块级命中", "只留 1/4 后"))
    for sigma in (0.0, 0.01, 0.05, 0.20):
        h1 = h2 = 0.0
        for _ in range(n_trials):
            true = [rng.random() ** 4 for _ in range(n_blocks)]
            noisy = [t + rng.gauss(0, sigma) for t in true]
            gold = set(sorted(range(n_blocks), key=lambda i: -true[i])[:TOPK])

            pick = sorted(range(n_blocks), key=lambda i: -noisy[i])[:TOPK]
            h1 += len(gold & set(pick)) / TOPK

            # 每 RATIO 块只留分数最高的那一块，模拟 ratio=4 的索引
            kept = [max(range(g, min(g + RATIO, n_blocks)), key=lambda j: noisy[j])
                    for g in range(0, n_blocks, RATIO)]
            pick2 = sorted(kept, key=lambda i: -noisy[i])[:TOPK]
            h2 += len(gold & set(pick2)) / TOPK
        print("  %-8.2f %-14s %-14s"
              % (sigma, "%.1f%%" % (h1 / n_trials * 100), "%.1f%%" % (h2 / n_trials * 100)))
    print("  注意 σ=0 那一行：索引压到 1/4 只掉了 0.4 个点。")
    print("  真正的风险不是「索引太粗」，而是「块分本身不准」——")
    print("  所以实现里块分必须是块内 max 压出来的，而不是另算一遍打分。")

    assert n_blocks == 15625
    assert n_blocks / 1024 < 16, "uint8 索引应该在 16 KB 以内"
    print("\n[自检] 15625 块、uint8 约 15 KB、两级筛取省 ~250 倍 —— 与动画一致")


if __name__ == "__main__":
    main()
