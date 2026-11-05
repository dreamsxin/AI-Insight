#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-22 同一个输入，同一个输出

对应动画：docs/inf-22-batch-invariant-animation.html

「logits 只差 1e-7」听起来无害，但 top-1 是靠比较决出来的。
这一份在 fp32 上真的把这个翻转做出来：

  1. 同一组数换个求和顺序，结果差几百个 ulp
  2. 两个候选的差比这个噪声还小 → top-1 翻面
  3. 固定归约顺序（padding 到同一长度 + 成对求和）之后，两次跑逐位相同

    python examples/anim-demos/inf-22-batch-invariant.py
"""
import numpy as np

N = 64          # 归约长度（对齐后的块）


def seq(xs):
    acc = np.float32(0)
    for v in xs:
        acc = np.float32(acc + v)
    return acc


def pairwise(xs):
    """固定形状的成对归约 —— 与行数、行序都无关。"""
    cur = [np.float32(v) for v in xs]
    while len(cur) > 1:
        nxt = []
        for i in range(0, len(cur), 2):
            a = cur[i]
            b = cur[i + 1] if i + 1 < len(cur) else np.float32(0)
            nxt.append(np.float32(a + b))
        cur = nxt
    return cur[0]


def bits(x):
    return int(np.float32(x).view(np.uint32))


def main():
    rng = np.random.default_rng(22)
    row = rng.standard_normal(N).astype(np.float32)

    a = seq(row)
    b = seq(row[::-1])
    print("一、同一行数，两种顺序")
    print("  正序  %.9g  (0x%08x)" % (a, bits(a)))
    print("  逆序  %.9g  (0x%08x)" % (b, bits(b)))
    print("  相差 %d 个 ulp，相对误差 %.1e" % (abs(bits(a) - bits(b)), abs(a - b) / abs(a)))

    print()
    print("二、让噪声大过候选之间的差距")
    noise = abs(float(a) - float(b))
    A = np.float32(1.0)
    B = np.float32(1.0 - noise * 0.5)      # 两个候选只差噪声的一半
    a_hi = np.float32(A + noise * 0.5)     # A 走了正序
    a_lo = np.float32(A - noise * 0.5)     # A 走了逆序
    print("  A = %.9g，B = %.9g（真值差 %.1e）" % (A, B, float(A) - float(B)))
    print("  同一份输入，A 的归约走了正序 → %.9g，走了逆序 → %.9g"
          % (a_hi, a_lo))
    print("  于是两次运行分别得到：")
    print("    第一次 argmax = %s" % ("A" if a_hi > B else "B"))
    print("    第二次 argmax = %s" % ("A" if a_lo > B else "B"))
    flipped = (a_hi > B) != (a_lo > B)
    print("  %s" % ("→ 同一个输入，两个输出。用户看到的是「模型今天脾气不一样」。" if flipped
                    else "→ 这一把没翻（噪声刚好没跨过去），但距离只差半个 ulp。"))
    print("  注意：logits 差 1e-7 本身无害，无害的是「连续量」；")
    print("  有害的是 argmax —— 它是阶跃的，跨过去就是另一个 token。")

    print()
    print("三、固定顺序就不再翻")
    pa, pb = pairwise(row), pairwise(row[::-1])
    print("  成对归约 正序 %.9g / 逆序 %.9g → 差 %d ulp"
          % (pa, pb, abs(bits(pa) - bits(pb))))
    print("  因为归约树的形状只由 N 决定，与「这一批有多少行」无关。")
    print("  这就是 BATCH_INVARIANT 要做的事：把归约形状钉死。")

    print()
    print("四、三个破坏者")
    print("  归约顺序  → 上面的 1e-7")
    print("  分块大小  → 同一段 KV 分成 7 块还是 8 块，和就不同")
    print("  专家位置  → 同一个专家在 rank 3 还是 rank 5，累加顺序就变了")
    print("  前两个能靠固定形状解决，第三个要靠「位置不影响数值」的设计。")

    assert abs(bits(a) - bits(b)) > 0
    assert flipped, "构造的间距必须让 top-1 翻面"
    assert abs(bits(pa) - bits(pb)) == 0, "成对归约在同形状下必须逐位相同"
    print("\n[自检] 顺序差 %d ulp、成对归约差 0 ulp —— 与动画一致" % abs(bits(a) - bits(b)))


if __name__ == "__main__":
    main()
