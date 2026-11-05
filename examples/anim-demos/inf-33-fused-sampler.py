#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-33 只留一个 id

对应动画：docs/inf-33-fused-sampler-animation.html

采样是每步最后一段，也是发射次数最密的一段。这一份演示：
  1. 七步七发射，能压成一段的是哪七步
  2. 随机数不是一条流，是「地址」—— (seed, seq, position, tag) 决定一切
  3. 于是打乱行序、改变批大小，每行的结果都不变

    python examples/anim-demos/inf-33-fused-sampler.py
"""
import math

MASK = (1 << 64) - 1
STEPS = [
    "取 logits 最后一列",
    "除以温度",
    "softmax",
    "top-k 掩码",
    "top-p 掩码",
    "按概率抽一个",
    "把 id 写回行尾",
]


def u01(seed, seq, pos, tag=0):
    """counter-based：同一个 (seed, seq, pos, tag) 永远同一个数。"""
    x = (seed * 0x9E3779B97F4A7C15
         + seq * 0xBF58476D1CE4E5B9
         + pos * 0x94D049BB133111EB
         + tag) & MASK
    x ^= x >> 30
    x = (x * 0xBF58476D1CE4E5B9) & MASK
    x ^= x >> 27
    x = (x * 0x94D049BB133111EB) & MASK
    x ^= x >> 31
    return (x >> 11) / float(1 << 53)


def softmax_top(logits, k, p):
    m = max(logits)
    e = [math.exp(v - m) for v in logits]
    s = sum(e)
    probs = [v / s for v in e]
    order = sorted(range(len(probs)), key=lambda i: -probs[i])[:k]     # top-k
    kept, acc = [], 0.0
    for i in order:                                                     # top-p
        kept.append(i)
        acc += probs[i]
        if acc >= p:
            break
    tot = sum(probs[i] for i in kept)
    return [(i, probs[i] / tot) for i in kept]


def sample(probs, u):
    acc = 0.0
    for i, q in probs:
        acc += q
        if u < acc:
            return i
    return probs[-1][0]


def main():
    print("一、七步，七次发射")
    for n, s in enumerate(STEPS, 1):
        print("  %d. %s" % (n, s))
    print("  每步都要落一次 kernel —— 20 万个数过一个 kernel，时间是花在「赶路」上的。")

    print()
    print("二、每步省 6 次发射")
    for batch in (1, 32, 128):
        print("  batch %3d：融合前 %d 次/步 → 融合后 %d 次/步（省 %d 次）"
              % (batch, 7, 1, 6))
    print("  与 batch 无关 —— 省的是「次数」，不是「数据量」。")

    print()
    print("三、随机数是地址，不是流")
    print("  u01(seed=0, seq=7, pos=3) = %.6f" % u01(0, 7, 3))
    print("  再调一次：                  %.6f  ← 完全一样" % u01(0, 7, 3))
    print("  换成 seq=8：                %.6f  ← 另一个地址，另一个数" % u01(0, 8, 3))

    # 三个 tag 之间的相关性应接近 0
    xs = [u01(0, 0, i, tag=1) for i in range(2000)]
    ys = [u01(0, 0, i, tag=2) for i in range(2000)]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    cov = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    vx = sum((a - mx) ** 2 for a in xs)
    vy = sum((b - my) ** 2 for b in ys)
    rho = cov / math.sqrt(vx * vy)
    print("  两个 tag 的相关系数 %.4f —— tag 隔离住了，两条流互不牵连。" % rho)

    print()
    print("四、打乱行序，每行结果不变")
    # 每行一份自己的 logits，避免全抽到同一个 id 看不出差别
    logits = [[4.0 * u01(9, r, i) for i in range(5)] for r in range(12)]

    def run(order):
        out = {}
        for row in order:
            pr = softmax_top(logits[row], k=3, p=0.9)
            out[row] = sample(pr, u01(1234, row, 0, tag=7))
        return out

    a = run(range(12))
    b = run(list(reversed(range(12))))
    c = run([5, 0, 11, 3, 8, 1, 9, 2, 10, 4, 7, 6])
    print("  正序   %s" % [a[i] for i in range(12)])
    print("  反序   %s" % [b[i] for i in range(12)])
    print("  乱序   %s" % [c[i] for i in range(12)])
    print("  逐行单跑和整批跑，结果逐位相同 —— 评测才可复现。")

    assert [a[i] for i in range(12)] == [b[i] for i in range(12)] == [c[i] for i in range(12)]
    assert abs(rho) < 0.06
    assert u01(0, 7, 3) == u01(0, 7, 3)
    print("\n[自检] 行序无关、tag 不相关、地址可重放 —— 与动画三条断言一致")


if __name__ == "__main__":
    main()
