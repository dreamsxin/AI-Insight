#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-20 六十秒搬家

对应动画：docs/inf-20-grace-period-animation.html

下线一台 decode 实例，为什么是 60 秒而不是 0 秒、也不是 10 分钟：
  1. 一次要把「未完成的请求 + 它们的 KV」一起交出去
  2. 交的是字节，所以先算带宽 —— 它几乎从来不是瓶颈
  3. 真正决定 60 秒的是「最长的那些请求还要跑多久」

    python examples/anim-demos/inf-20-grace-period.py
"""
REQUESTS = 40         # 一台实例上正在跑的请求数
KV_MB = 3.0           # 每条的 KV 缓存
NIC_GBS = 6.25        # 每卡能拿到的带宽（400 Gbps / 8 卡）
GRACE = 60            # 宽限期（秒）


def main():
    print("一、要搬多少字节")
    total = REQUESTS * KV_MB
    print("  %d 条 × %.0f MB = %.0f MB" % (REQUESTS, KV_MB, total))
    t = total / 1024 / NIC_GBS
    print("  按 %.2f GB/s：%.1f ms" % (NIC_GBS, t * 1000))
    print("  搬运本身只花几十毫秒 —— 所以 60 秒显然不是给带宽留的。")

    print()
    print("二、60 秒是给「尾巴」留的")
    print("  %-18s %8s %8s %10s" % ("请求类型", "已生成", "剩余", "还要跑"))
    for kind, done, left, tpot in (
        ("短问答", 40, 10, 22),
        ("中等", 300, 500, 22),
        ("长报告", 2000, 2000, 22),
        ("最坏情况", 3000, 8000, 22),
    ):
        sec = left * tpot / 1000
        print("  %-18s %8d %8d %9.1f s" % (kind, done, left, sec))
    print("  60 秒 ≈ %.0f 个 token 的余量（按 22 ms/token）。" % (GRACE / 0.022))
    print("  刚好够「手上这批跑完」，又不会让整机下线拖上十几分钟。")

    print()
    print("三、超额的那部分怎么办")
    over = 8000 * 0.022           # 最坏情况还要 176 秒
    print("  最坏情况要 %.0f 秒，超过 60 秒 → 不在原地等，直接转交：" % over)
    print("    1. 未完成的请求连同 KV 一起发出去（%.0f MB/条）" % KV_MB)
    print("    2. 新实例接着往下 decode，用户只看到一次稍长的间隔")
    print("    3. 超过 60 秒还没交完的，标记为需要重算 —— 宁可重算，不要卡住")
    print("  换句话说：60 秒不是「必须跑完」的期限，是「必须交完」的期限。")

    print()
    print("四、为什么不是 0 秒")
    print("  0 秒下线 = 所有在跑的请求瞬间断，用户看到的是失败而不是变慢。")
    print("  容错靠两件事：配额冗余（还有别的实例接着）+ 平滑转交（不是重启）。")

    assert abs(REQUESTS * KV_MB - 120) < 1e-9
    assert REQUESTS * KV_MB / 1024 / NIC_GBS < 0.1, "带宽不该是瓶颈"
    print("\n[自检] 120 MB / 约 19 ms、60 秒 ≈ 2700 token 余量 —— 与动画一致")


if __name__ == "__main__":
    main()
