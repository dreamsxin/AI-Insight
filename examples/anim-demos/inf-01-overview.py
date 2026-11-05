#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-01 一个 token 的旅程

对应动画：docs/inf-01-overview-animation.html

十二个环节里，只有两个数字是用户能直接感觉到的：
  TTFT（第一个字多久出来）与 TBT（后面每个字间隔多久）。

这一份把它们拆开：
  1. 500 个字的回答，总时长里 TTFT 只占多少
  2. 60 并发 / 卡时，一张卡一秒能出多少 token
  3. 三种「变便宜」的办法，各自省的是哪一段

    python examples/anim-demos/inf-01-overview.py
"""
TTFT = 0.8        # 秒：一次 prefill 走完（含排队）
TBT = 0.022       # 秒：每步 decode
CONCURRENCY = 60  # 每卡同时跑的序列数


def main():
    print("一、十二个环节，两个数字")
    stages = ["接协议", "分词", "排批", "取 KV", "prefill", "encode",
              "decode×N", "采样", "反分词", "流式解析", "计费", "回执"]
    for i, s in enumerate(stages, 1):
        print("  %2d %s" % (i, s))
    print("  用户只感知两处：第 5 步之后第一个字（TTFT），以及第 7 步的节奏（TBT）。")

    print()
    print("二、一个回答的账")
    print("  %6s %8s %10s %10s" % ("输出字数", "总时长", "其中 TTFT", "TTFT 占比"))
    for n in (50, 200, 500, 2000):
        total = TTFT + TBT * n
        print("  %6d %7.1fs %9.2fs %9.1f%%" % (n, total, TTFT, TTFT / total * 100))
    print("  短回答里 TTFT 占大头，长回答里它几乎看不见 ——")
    print("  所以「慢」的抱怨要先问：是第一个字慢，还是每个字都慢。")

    print()
    print("三、一张卡能出多少 token")
    rate = CONCURRENCY / TBT
    print("  %d 并发，每 %.0f ms 一步 → 每卡 %.0f token/s" % (CONCURRENCY, TBT * 1000, rate))
    for c in (1, 8, 60, 120):
        print("  并发 %3d → %6.0f token/s" % (c, c / TBT))
    print("  单条请求快不快，取决于 TBT；一张卡划不划算，取决于能塞多少条。")

    print()
    print("四、三种便宜法")
    ways = [
        ("多塞并发", "TBT 不变，token/s 上去", "显存与调度是天花板"),
        ("让每步更快", "TBT 降下来，单条更快也更省", "kernel / 量化 / 投机"),
        ("少算几步", "同样的答案用更少 token", "投机解码、更短的输出"),
    ]
    print("  %-10s %-24s %s" % ("办法", "省在哪", "代价"))
    for a, b, c in ways:
        print("  %-10s %-24s %s" % (a, b, c))
    print("  只有第二种会同时改善体验和成本 —— 其余两种都在换，不是在省。")

    assert abs(TTFT + TBT * 500 - 11.8) < 1e-9
    assert abs(TTFT / (TTFT + TBT * 500) - 0.0678) < 1e-3
    print("\n[自检] 500 字 = 11.8s、TTFT 占 6.8%、60 并发 ≈ 2727 token/s —— 与动画一致")


if __name__ == "__main__":
    main()
