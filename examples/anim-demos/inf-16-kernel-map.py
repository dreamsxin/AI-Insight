#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-16 一个 step 的 kernel 账单

对应动画：docs/inf-16-kernel-map-animation.html

decode 一步有 11 段 kernel，但真正吃算力的只有 3 段。
这一份把它们按「算 / 通 / 等」分类记账，然后回答一个问题：
空隙到底占多少，融合一次能省回来多少。

    python examples/anim-demos/inf-16-kernel-map.py
"""
# (阶段, 类别, 时间占比%)  —— 占比为示意，与 inf-18 的 26/42/21/11 一致
STAGES = [
    ("01 准备 metadata", "其它", 2.0),
    ("02 norm + 量化", "其它", 3.0),
    ("03 按 block 取 KV", "通信", 6.0),
    ("04 注意力", "计算", 26.0),
    ("05 路由 top-k", "其它", 1.5),
    ("06 dispatch", "通信", 8.0),
    ("07 专家 GEMM", "计算", 42.0),
    ("08 combine", "通信", 7.0),
    ("09 norm + lm_head", "计算", 3.0),
    ("10 采样", "其它", 1.0),
    ("11 写回 KV", "通信", 0.5),
]


def main():
    total = sum(t for _, _, t in STAGES)
    print("一、一步的 11 段")
    print("  %-20s %-6s %6s  %s" % ("阶段", "类别", "占比", ""))
    for name, kind, t in STAGES:
        bar = "█" * int(t / 2)
        mark = "  ← 吃算力" if kind == "计算" else ""
        print("  %-20s %-6s %5.1f%%  %s%s" % (name, kind, t, bar, mark))

    by = {}
    for _, kind, t in STAGES:
        by[kind] = by.get(kind, 0) + t
    print()
    print("  计算 %.0f%%   通信 %.0f%%   其它 %.0f%%（合计 %.0f%%）"
          % (by["计算"], by["通信"], by["其它"], total))
    print("  11 段里只有 3 段在算，但它们占了 %.0f%% —— 剩下的时间是「搬」和「等」。"
          % by["计算"])

    print()
    print("二、空隙有多大")
    print("  「其它」那几段里，大部分是启动与同步，不是浮点运算：")
    gaps = sum(t for _, kind, t in STAGES if kind == "其它")
    print("  其它 %.0f%% 里约 %.0f%% 是空隙 → 等效 SM 空转 %.0f%% 的时间"
          % (gaps, gaps * 0.5, gaps * 0.5))
    print("  空隙的代价不只是「浪费时间」，是这段时间 SM 完全空着，")
    print("  而数据还得在显存里落一趟再读回来。")

    print()
    print("三、融合能省回什么")
    # 融合 06/07/08：中间结果不落回显存
    fuse = [s for s in STAGES if s[0][:2] in ("06", "07", "08")]
    before = sum(t for _, _, t in fuse)
    print("  dispatch + GEMM + combine 当前占 %.0f%%" % before)
    print("  三段各写一次读一次，中间张量在显存里过 3 趟；")
    print("  融成一段后只在最后写一次 —— 省的是这 %d 趟搬运，不是浮点。" % (3 - 1))
    saved = before * 0.18
    print("  按搬运占这三段的 18%% 估，一步省 %.1f%%；端到端再打个折。" % saved)

    print()
    print("四、为什么只值得融三处")
    print("  融合的收益 ≈ 省下的字节 / 总时间。占比小的段，融了也看不见：")
    for name, kind, t in sorted(STAGES, key=lambda s: -s[2])[:6]:
        print("    %-20s %5.1f%%  融合后最多省 %.2f 个点（按省一半算）" % (name, t, t / 2))

    assert abs(total - 100.0) < 1e-9
    assert by["计算"] == 71.0
    print("\n[自检] 11 段合计 100%、计算 71%（26+42+3）—— 与动画一致")


if __name__ == "__main__":
    main()
