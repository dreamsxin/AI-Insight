#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-06 别让 GPU 等 CPU

对应动画：docs/inf-06-scheduler-animation.html

一个长 prompt 进来，如果整段一起算，后面的 decode 全被堵住。
这一份把「切片」这件事算清楚：

  1. 一个 step 能吃多少 token（预算 × 速率）
  2. 10 万 token 的 prompt 切成几片、每片多久
  3. 为什么片大小是「反解」出来的，不是拍出来的

    python examples/anim-demos/inf-06-scheduler.py
"""
BUDGET_TOKENS = 32768      # 单步 token 上限（硬预算）
STEP_MS = 20.0             # 一个 step 的时间预算
PREFILL_KTOK_S = 12.0      # prefill 吞吐（k token/s，示意）
DECODE_MS = 0.4            # 每个 decode 序列在一批里的边际开销


def main():
    print("一、一个 step 能吃多少")
    cap_time = PREFILL_KTOK_S * STEP_MS              # 毫秒 × k token/s = token
    print("  %d token 是硬上限（超了会 OOM 或超时）" % BUDGET_TOKENS)
    print("  按 %.0f ms 的时间预算、%.0f k token/s 的速率 → %.0f token"
          % (STEP_MS, PREFILL_KTOK_S, cap_time))
    print("  两个上限取小的那个：本步最多算 %d token。" % min(BUDGET_TOKENS, cap_time))

    print()
    print("二、长 prompt 切几片")
    chunk = int(min(BUDGET_TOKENS, cap_time))
    for n in (8192, 65536, 100_000):
        k = (n + chunk - 1) // chunk
        print("  %7d token → %d 片，每片约 %.1f ms（%d token）"
              % (n, k, chunk / (PREFILL_KTOK_S * 1000) * 1000, chunk))
    print("  切片之后，每片之间可以插一段 decode —— 别的请求不必等它整段跑完。")

    print()
    print("三、反解片大小")
    print("  实际做法是反过来的：先定「这一步想花多久」，再算能塞多少 token。")
    print("  %8s %12s %12s" % ("时间预算", "可塞 token", "受限于"))
    for ms in (5, 10, 20, 40):
        tok = PREFILL_KTOK_S * ms
        real = min(BUDGET_TOKENS, tok)
        why = "硬预算" if tok > BUDGET_TOKENS else "时间"
        print("  %7.0fms %12.0f %12s" % (ms, real, why))
    print("  预算单位是纳秒级时钟，组内再取一次最小值 —— 避免某个请求把人拖超时。")

    print()
    print("四、为什么必须和 decode 抢同一个 step")
    print("  GPU 只有一份，prefill 和 decode 都要用。分时切片是唯一能让两者共存的办法：")
    print("  整段 prefill → decode 全停（首字快，其余全卡）")
    print("  切片 prefill → decode 慢一点，但没有请求被饿死")
    print("  这就是「交互式服务」和「离线批处理」在调度上的分界线。")

    assert min(BUDGET_TOKENS, PREFILL_KTOK_S * STEP_MS) == 240
    assert (100_000 + 239) // 240 == 417
    print("\n[自检] 单步 240 token、10 万 token 切 417 片 —— 与动画一致")


if __name__ == "__main__":
    main()
