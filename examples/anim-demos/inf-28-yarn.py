#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-28 位置怎么被拉长

对应动画：docs/inf-28-yarn-animation.html

把 YaRN 的两段频率真的算出来：
  1. 哪些维度属于「高频」，哪些属于「低频」（beta_fast=32 / beta_slow=1 决定的）
  2. 低频维插值、高频维不动、中间一段按余弦斜坡过渡
  3. 压缩之后，同样两个位置的相位差怎么变小 —— 这就是「一格代表更远」
  4. mscale 为什么随倍数变

    python examples/anim-demos/inf-28-yarn.py
"""
import math

DIM = 128            # 头维度（每维一对，实际旋转只在 dim/2 个频率上）
BASE = 10000.0       # rope_theta
ORIG = 4096          # 训练时的最大位置
TARGET = 1048576     # 想推到 1M
BETA_FAST = 32.0     # 高频这一侧的转速（每多少个 token 转一圈）
BETA_SLOW = 1.0      # 低频这一侧


def inv_freq(dim=DIM, base=BASE):
    """每个频率维的角速度（弧度 / token）。"""
    return [1.0 / (base ** (2 * i / dim)) for i in range(dim // 2)]


def correction_dim(rotations, dim=DIM, base=BASE, max_pos=ORIG):
    """哪一维的波长正好等于 max_pos / rotations 个 token。

    YaRN 用它来划「该压缩」和「不该压缩」的边界。
    """
    return (dim * math.log(max_pos / (rotations * 2 * math.pi))) / (2 * math.log(base))


def ramp_mask(low, high, n):
    """两段之间的过渡：low 之前是 1（不动），high 之后是 0（全压）。"""
    if low == high:
        high += 0.001
    return [min(1.0, max(0.0, (high - i) / (high - low))) for i in range(n)]


def yarn_inv_freq(scale, dim=DIM, base=BASE, orig=ORIG):
    base_freq = inv_freq(dim, base)
    lo = math.floor(correction_dim(BETA_FAST, dim, base, orig))
    hi = math.ceil(correction_dim(BETA_SLOW, dim, base, orig))
    lo, hi = max(lo, 0), min(hi, dim // 2 - 1)
    mask = ramp_mask(lo, hi, dim // 2)
    # mask=1 → 保持原速（高频，近处靠它分辨）；mask=0 → 按 scale 拉长（低频，远处靠它铺开）
    return [base_freq[i] * (mask[i] + (1 - mask[i]) / scale) for i in range(dim // 2)], lo, hi, mask


def mscale(scale, alpha=0.1):
    """位置被拉长后注意力分布变平，用温度补偿把 logit 拉回来一点。"""
    return alpha * math.log(scale) + 1.0


def main():
    scale = TARGET / ORIG
    print("目标倍数 = %d / %d = %.0f×" % (TARGET, ORIG, scale))

    lo = math.floor(correction_dim(BETA_FAST))
    hi = math.ceil(correction_dim(BETA_SLOW))
    print("beta_fast=%.0f → 第 %d 维以下不动；beta_slow=%.0f → 第 %d 维以上全压"
          % (BETA_FAST, lo, BETA_SLOW, hi))

    f0 = inv_freq()
    f1, lo, hi, mask = yarn_inv_freq(scale)

    print()
    print("  维度   原波长(token)     压缩后     ratio   处理")
    for i in (0, 8, 16, 20, 32, 44, 45, 52, 63):
        w0 = 2 * math.pi / f0[i]
        w1 = 2 * math.pi / f1[i]
        kind = "不动" if mask[i] > 0.999 else ("插值" if mask[i] < 0.001 else "斜坡 %.2f" % mask[i])
        print("  %4d %12.1f %11.1f %8.2f×  %s" % (i, w0, w1, w1 / w0, kind))

    print()
    print("高频维（第 0 维）波长只有 %.1f 个 token —— 它负责分辨相邻词序，" % (2 * math.pi / f0[0]))
    print("压它等于把近处的分辨率直接抹掉，所以 YaRN 一个字都不动它。")

    print()
    print("二、同样两个位置，相位差怎么变")
    print("  %-18s %10s %10s" % ("位置对", "原相位差", "压缩后"))
    for a, b in ((100, 200), (8000, 16000), (100000, 100064)):
        p0 = (b - a) * f0[52]
        p1 = (b - a) * f1[52]
        print("  %-18s %9.4f %9.4f  (第 52 维)" % ("%d → %d" % (a, b), p0, p1))

    print()
    print("三、温度补偿")
    for sc in (1, 4, 16, 64, 256):
        print("  scale=%3d → mscale=%.4f" % (sc, mscale(sc)))
    print("  位置铺得越开，注意力越平；mscale 把 logit 乘回去，避免输出变得糊。")

    # 自检：与动画屏幕上的 4096 / 1048576 对得上
    assert TARGET / ORIG == 256
    assert lo == 20 and hi in (45, 46), (lo, hi)   # ceil 吃掉了 45.02 的零头
    assert abs(mscale(256) - 1.5545) < 1e-3
    assert f1[0] == f0[0], "高频维必须一点不动"
    assert abs(f1[63] - f0[63] / 256) < 1e-12, "最低频那一维应该压满 256 倍"
    print("\n[自检] 边界 20/45、mscale(256)=1.5545、第 0 维不动、第 63 维压 256× —— 与动画一致")


if __name__ == "__main__":
    main()
