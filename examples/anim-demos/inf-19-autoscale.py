#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-19 扩看请求，缩看水位

对应动画：docs/inf-19-autoscale-animation.html

自动扩容的规则很短，但每条都能算出后果：
  1. 算出来要 10 台，实际开 12 台 —— 那 2 台是买「不会排队」的保险
  2. 缩容红线 0.8：利用率 0.86 时不许缩
  3. 限速与上下界：一次扩太多会把冷启动摊给用户

    python examples/anim-demos/inf-19-autoscale.py
"""
CAPACITY = 100.0      # 每台每秒能吃多少「请求·token」，示意单位
WATERMARK = 0.8       # 缩容红线
BOUNDS = (2, 40)      # 最少 / 最多台数
STEP_LIMIT = 1.5      # 每个周期最多扩到 1.5 倍


def want(demand):
    """算需求要几台（向上取整）+ 冗余配额。"""
    need = demand / CAPACITY
    base = max(1, int(need) + (1 if need % 1 else 0))
    spare = 1 if base < 4 else max(2, round(base * 0.2))   # 冗余：小集群 1 台，大集群 20%
    return base, base + spare


def main():
    print("一、算出来的和开出来的")
    print("  %8s %8s %8s %9s" % ("需求", "理论", "实际开", "利用率"))
    for d in (200, 600, 1000, 1400):
        base, run = want(d)
        lo, hi = BOUNDS
        run = min(hi, max(lo, run))
        print("  %8d %8d %8d %8.2f" % (d, base, run, d / (run * CAPACITY)))
    print("  需求 1000 时理论 10 台，实际开 12 台 —— 利用率 0.83，")
    print("  多出来的 2 台不是浪费，是「尖峰进来时不排队」的保费。")

    print()
    print("二、缩容红线")
    print("  %8s %8s %12s" % ("当前台数", "利用率", "能否删掉一台"))
    for n, d in ((12, 1032), (12, 1000), (12, 900), (12, 700)):
        util = d / (n * CAPACITY)
        del_util = d / ((n - 1) * CAPACITY)
        ok = util <= WATERMARK and del_util <= 1.0
        print("  %8d %8.2f %12s（删后 %.2f）"
              % (n, util, "可以" if ok else "不行", del_util))
    print("  规则：当前水位 > 0.8 就不缩 —— 不是因为「还能撑」，")
    print("  是因为缩完立刻顶到天花板，下一次尖峰就得排队。")

    print()
    print("三、限速")
    n = 4
    for target in (6, 8, 12, 20):
        planned = min(target, int(n * STEP_LIMIT))
        print("  当前 %2d 台，想扩到 %2d → 本周期先到 %2d 台（上限 %.1f 倍）"
              % (n, target, planned, STEP_LIMIT))
    print("  一步步扩，冷启动的代价被摊平；一次扩到位，第一批请求全在等。")

    print()
    print("四、两个指标不是一回事")
    print("  prefill 看「未命中的 token 数」—— 长 prompt 进来时它先跳。")
    print("  decode  看「正在跑的请求数」—— 会话变多时它先跳。")
    print("  用同一个指标同时管两边，会一边过配、一边欠配。")

    base, run = want(1000)
    assert base == 10 and run == 12
    assert round(1032 / (12 * CAPACITY), 2) > WATERMARK
    print("\n[自检] 需求 1000 → 理论 10 台 / 实际 12 台、0.86 时拒绝缩容 —— 与动画一致")


if __name__ == "__main__":
    main()
