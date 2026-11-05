#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-31 一百次发射

对应动画：docs/inf-31-cuda-graph-animation.html

CUDA Graph 的桶化，可以用十几行算清楚：
  1. 桶表怎么长出来（1、2、4 之后每 8 个一个，默认 interval=8）
  2. 真实 batch 落进哪个桶（bisect_left，向上取整）
  3. 白算多少行、白算的比例有多难看
  4. 为什么 num_reqs 必须记真实请求数（padding 陷阱）

    python examples/anim-demos/inf-31-cuda-graph.py
"""
from bisect import bisect_left

MAX_BATCH = 64
INTERVAL = 8


def build_buckets(max_batch=MAX_BATCH, interval=INTERVAL):
    """1、2、4 打底，之后每 interval 一个。"""
    sizes = [1, 2, 4]
    b = interval
    while b <= max_batch:
        if b not in sizes:
            sizes.append(b)
        b += interval
    if max_batch not in sizes:
        sizes.append(max_batch)
    return sorted(sizes)


def pick(buckets, n):
    """向上取整选桶：第一个 >= n 的桶。"""
    i = bisect_left(buckets, n)
    return buckets[i] if i < len(buckets) else None


def main():
    buckets = build_buckets()
    print("一、桶表：%d 张图" % len(buckets))
    print("  " + " ".join(map(str, buckets)))
    print("  1、2、4 打底（小 batch 不可能等），之后每 %d 个录一张。" % INTERVAL)

    print()
    print("二、真实 batch 落进哪个桶")
    print("  %6s %6s %6s %10s" % ("batch", "桶", "白算", "白算占比"))
    worst = (0, 0)
    for n in (1, 3, 9, 17, 37, 40, 63, 64):
        k = pick(buckets, n)
        waste = k - n
        pct = waste / k * 100
        print("  %6d %6d %6d %9.1f%%" % (n, k, waste, pct))
        if pct > worst[1]:
            worst = (n, pct)

    print()
    print("  最坏的一档：batch %d 落进 %d，白算 %.1f%%。"
          % (worst[0], pick(buckets, worst[0]), worst[1]))
    print("  相邻两桶最多差 %d 行；相对浪费最大的是「刚跨过桶」的那一段。" % (INTERVAL - 1))
    print("  桶越密越省，但图也越多 —— 这是纯粹的取舍，没有免费的一侧。")

    print()
    print("三、整张表：1–64 的平均白算")
    total = sum(pick(buckets, n) - n for n in range(1, MAX_BATCH + 1))
    got = sum(pick(buckets, n) for n in range(1, MAX_BATCH + 1))
    print("  平均白算 %.2f 行 / 平均跑 %.1f 行 → %.1f%%"
          % (total / MAX_BATCH, got / MAX_BATCH, total / got * 100))
    geo = [1, 2, 4, 8, 16, 32, 64]                      # 等比桶：图更少，浪费更多
    gw = sum(pick(geo, n) - n for n in range(1, 65))
    gg = sum(pick(geo, n) for n in range(1, 65))
    print("  若改用等比桶 %s（7 张图），平均白算升到 %.1f%%。" % (geo, gw / gg * 100))

    print()
    print("四、padding 陷阱")
    real, bucket = 37, 40
    print("  真实请求 %d 条，图按 %d 行跑，末尾 %d 行是空的。" % (real, bucket, bucket - real))
    print("  这 %d 行照样走完整前向，只是结果被丢掉 —— 但统计里不能算进去。" % (bucket - real))
    print("    num_reqs = %d  ← 正确：真实请求数" % real)
    print("    num_reqs = %d  ← 错误：把 padding 当成请求" % bucket)
    print("  错法的后果：吞吐算低、CP 广播把空行也发出去、采样多做 %d 次。"
          % (bucket - real))

    assert len(build_buckets()) == 11
    assert pick(buckets, 37) == 40 and pick(buckets, 9) == 16
    assert pick(buckets, 64) == 64 and pick(buckets, 1) == 1
    print("\n[自检] 11 张图、37→40、9→16、8 与 64 恰好整除 —— 与动画滑杆一致")


if __name__ == "__main__":
    main()
