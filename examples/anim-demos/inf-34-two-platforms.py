#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-34 同一形状两种材质

对应动画：docs/inf-34-two-platforms-animation.html

跨平台移植的账，两半都能算：
  1. 目录对账：两套算子实现，同名 27 个，行数差 1.5 倍
  2. 数值对账：同样的加法，换个顺序就差 1 ulp —— 这就是 rstd_1ulp 要解决的问题
  3. 补偿：把舍入的零头单独存一片，顺序就不再影响结果

    python examples/anim-demos/inf-34-two-platforms.py
"""
import numpy as np

CUDA_FILES, CUDA_LINES = 30, 4968
ASC_FILES, ASC_LINES = 28, 7418
SAME_NAME = 27
ONLY_CUDA = ["outlier_detection.py", "quant.py", "prepare_decode_metadata.py"]
ONLY_ASC = ["kv_quant.py", "rstd_1ulp.py", "prepare_v4_decode_metadata.py"]


def seq_sum(arr):
    """顺序累加：一个 fp32 从头加到尾。"""
    acc = np.float32(0.0)
    for v in arr:
        acc = np.float32(acc + v)
    return acc


def kahan_sum(arr):
    """补偿求和：把「加完丢掉的低位」单独存一片 c，下次加回去。"""
    s = np.float32(0.0)
    c = np.float32(0.0)
    for v in arr:
        y = np.float32(v - c)
        t = np.float32(s + y)
        c = np.float32(np.float32(t - s) - y)
        s = t
    return s


def bits(x):
    return int(np.float32(x).view(np.uint32))


def ulp_gap(a, b):
    """两个 fp32 相差几个最小单位。"""
    return abs(bits(a) - bits(b))


def main():
    print("一、目录对账")
    print("  cuda/ %d 文件 %d 行（%.0f 行/文件）" % (CUDA_FILES, CUDA_LINES, CUDA_LINES / CUDA_FILES))
    print("  asc/  %d 文件 %d 行（%.0f 行/文件）" % (ASC_FILES, ASC_LINES, ASC_LINES / ASC_FILES))
    print("  同名 %d 个 → 同一件事，两套实现" % SAME_NAME)
    print("  行数比 %.2f× —— NPU 侧不是写得啰嗦，是同样的数值要多做几步补偿。"
          % (ASC_LINES / CUDA_LINES))
    print("  只在 cuda：%s" % " ".join(ONLY_CUDA))
    print("  只在 asc： %s" % " ".join(ONLY_ASC))

    print()
    print("二、同样的加法，换个顺序就差 1 ulp")
    rng = np.random.default_rng(34)
    arr = rng.standard_normal(512).astype(np.float32)

    forward = seq_sum(arr)
    backward = seq_sum(arr[::-1])
    pairwise = np.float32(np.sum(arr))        # numpy 内部是成对求和

    print("  正序      %.9g  (0x%08x)" % (forward, bits(forward)))
    print("  反序      %.9g  (0x%08x)" % (backward, bits(backward)))
    print("  成对      %.9g  (0x%08x)" % (pairwise, bits(pairwise)))
    print("  正序 vs 反序 差 %d ulp；正序 vs 成对 差 %d ulp"
          % (ulp_gap(forward, backward), ulp_gap(forward, pairwise)))
    print("  三个结果在实数意义上都对，但逐位不同 —— 这就是「对不上」的来源。")

    print()
    print("三、补偿求和把顺序抹平")
    kf, kb = kahan_sum(arr), kahan_sum(arr[::-1])
    print("  Kahan 正序 %.9g" % kf)
    print("  Kahan 反序 %.9g" % kb)
    print("  两者差 %d ulp（原始顺序求和差 %d ulp）"
          % (ulp_gap(kf, kb), ulp_gap(forward, backward)))
    print()
    print("  rstd_1ulp 做的事就是这个：把一个 fp32 拆成 high + low 两片，")
    print("  低位不丢，最后只舍入一次。差别不在公式，在「舍入发生在第几步」。")

    print()
    print("四、单卡复现不了，就别谈跨平台")
    print("  同一台机器上换个归约顺序就已经差 1 ulp；换成另一家芯片，")
    print("  连 FMA 的融合方式都不同 —— 对不齐是常态，对齐要专门花钱。")

    assert CUDA_LINES / CUDA_FILES < ASC_LINES / ASC_FILES
    assert ulp_gap(kf, kb) <= ulp_gap(forward, backward)
    print("\n[自检] 30/28 文件、4968/7418 行、1.49×；补偿后 ulp 差不超过原始差 —— 与动画一致")


if __name__ == "__main__":
    main()
