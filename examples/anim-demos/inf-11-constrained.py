#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-11 只能走对路

对应动画：docs/inf-11-constrained-animation.html

约束解码把「请输出 JSON」变成「物理上写不出来」。这一份算：
  1. 被约束的语言到底有多小 —— 为什么不能靠采样撞
  2. 拒绝重采样的期望次数：1 / p(合法)
  3. 掩码本身才多少字节，代价到底在哪
  4. 先掩码还是先 top_p —— 顺序会真的改变结果
  5. 逐步收窄：为什么长 token 更容易被判非法

    python examples/anim-demos/inf-11-constrained.py
"""
import math

VOCAB = 128000            # 词表 ≈ 12.8 万
LEGAL_AT_STEP11 = 32000   # 动画 07 节：已走 11 步，合法集合 ≈ 3.2 万
STATES = 4096             # 一个中等 schema 编译出的状态数


def top_p_filter(p, top_p):
    """核采样：按概率降序累加，直到累计 >= top_p。返回保留的下标集合。"""
    order = sorted(range(len(p)), key=lambda i: -p[i])
    kept, acc = [], 0.0
    for i in order:
        kept.append(i)
        acc += p[i]
        if acc >= top_p:
            break
    return set(kept)


def renorm(p, keep):
    s = sum(p[i] for i in keep)
    return {i: p[i] / s for i in keep}


def main():
    print("一、先看目标语言有多小")
    # ^[A-Z]{2}\d{6}$ —— 两位大写字母 + 六位数字
    lang = 26 ** 2 * 10 ** 6
    print("  ^[A-Z]{2}\\d{6}$ 的全部合法串：26² × 10⁶ = %d 个" % lang)
    print("  也就是 %.1f bit 的信息量" % math.log2(lang))
    print("  随机撞一次命中的概率：%.2e —— 平均要试 %.2e 次才中一条。" % (1 / lang, lang))
    print("  所以约束不是「事后过滤」，是「每一步只在这个集合里选」。")

    print()
    print("二、拒绝重采样的期望次数")
    print("  做法：照常采样，采到非法就丢掉重采 → 期望次数 E = 1 / p(合法)")
    for p_legal in (0.5, 0.1, 0.01, 0.004):
        print("    p(合法) = %5.1f%% → 平均要 %.0f 次前向才能吐 1 个合法 token"
              % (p_legal * 100, 1 / p_legal))
    print("  掩码只要 1 次。差的那几百次前向，就是「先采样再检查」的真实账单。")
    print("  注意：重采样本身不改变分布（数学上等价），它只是慢到不可用。")

    print()
    print("三、掩码占多少字节，代价到底在哪")
    per_step = VOCAB * 2     # fp16 掩码向量
    print("  一个 step 的掩码向量：%d × 2 B = %.0f KB" % (VOCAB, per_step / 1024))
    for conc, tps in ((1, 40), (96, 40), (512, 20)):
        bw = per_step * conc * tps / 2 ** 20
        print("    %3d 并发 × %2d token/s → %.1f MB/s 的掩码流量" % (conc, tps, bw))
    print("  这点流量对 HBM 是噪声。真正的代价是它每步都要算，且必须串行：")
    print("  自动机不推进，下一步的合法集合就出不来 —— 推不动就发不出 token。")
    print("  另一个真问题：预计算 (状态 × 词表) 的查表 = %d × %d bit = %.0f MB"
          % (STATES, VOCAB, STATES * VOCAB / 8 / 2 ** 20))
    print("  塞不进片上缓存，所以实际做法是按状态分片、或只存「非法集」的稀疏差集。")

    print()
    print("四、先掩码还是先 top_p —— 顺序真的会改变结果")
    p = [0.6, 0.3, 0.09, 0.01]
    illegal = 0
    top_p = 0.85
    print("  模型原始分布 p = %s，其中 token 0 非法，top_p = %.2f" % (p, top_p))
    a = top_p_filter(p, top_p)
    a_after = a - {illegal}
    a_after = renorm(p, a_after)
    print("  ① 先 top_p 再掩码：top_p 留下 %s（累计 %.2f）" % (sorted(a), sum(p[i] for i in a)))
    print("     掩掉 0 之后只剩 %s → 分布塌成 [1.0]，一个 token 通吃" % sorted(a_after))
    legal = [i for i in range(len(p)) if i != illegal]
    b = renorm(p, legal)
    b_after = top_p_filter([b[i] if i in b else 0.0 for i in range(len(p))], top_p)
    print("  ② 先掩码再 top_p：合法集重归一到 %s"
          % ["%.3f" % b[i] for i in legal])
    print("     再按 top_p 留 %s —— 合法集里有 2 个候选，不是 1 个" % sorted(b_after))
    print("  top_p 是按「累计质量」切的，先切会把合法 token 的质量算进已丢弃的非法项里。")
    print("  temperature 无所谓（它只缩放 logits，掩码后重归一化会抵消）；top_p 有所谓。")

    print()
    print("五、逐步收窄：为什么长 token 更容易非法")
    print("  判定是整串的：token 的每一个字节都要落在允许集内。")
    print("  若允许字节占 f、token 平均长 L，则存活率 = f^L：")
    print("    %-8s %s" % ("f \\ L", "".join("%7d" % L for L in range(1, 6))))
    for f in (0.86, 0.63, 0.40):
        print("    %-8.2f %s" % (f, "".join("%6.1f%%" % (f ** L * 100) for L in range(1, 6))))
    print("  动画里 11 步后合法集合 ≈ 3.2 万，占词表 %.0f%%。"
          % (LEGAL_AT_STEP11 / VOCAB * 100))
    target = LEGAL_AT_STEP11 / VOCAB
    f3 = target ** (1 / 3)
    print("  反解：L=3 时要 f = %.2f，也就是「只有 6 成字节被允许」。"
          % f3)
    print("  结构字符处 f 会掉到接近 0（只允许 1 个字节）—— 这才是长 JSON 的 decode")
    print("  忽快忽慢、并且整体略慢的原因：不是算力不够，是可选集合反复塌缩。")

    assert lang == 676000000
    assert abs(math.log2(lang) - 29.33) < 0.01
    assert a_after != b_after          # 两种顺序给出不同的候选集
    assert len(b_after) == 2
    assert abs(target - 0.25) < 0.001
    print("\n[自检] 6.76 亿个合法串、29.3 bit、3.2 万 / 12.8 万 = 25% —— 与动画一致")


if __name__ == "__main__":
    main()
