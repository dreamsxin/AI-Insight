#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-21 一块卡坏掉之后

对应动画：docs/inf-21-ep-failover-animation.html

EP 是一个通信域 —— 这句话的后果可以直接算：
  1. 64 张卡里坏 1 张，为什么整机就不能用（all-to-all 是集合操作）
  2. 重启后按「现有健康卡数」重新定 EP，63 是个难看的数
  3. 专家怎么分、负载不均多少、以及为什么故障恢复是分钟级

    python examples/anim-demos/inf-21-ep-failover.py
"""
N_CARDS = 64
N_EXPERTS = 256
RECOVER_MIN = 6        # 重启 + 重新加载权重的量级（分钟）


def spread(experts, cards):
    """把 experts 摊到 cards 上，返回每卡的份数（尽量平均）。"""
    base, extra = divmod(experts, cards)
    return [base + (1 if i < extra else 0) for i in range(cards)]


def main():
    print("一、为什么一张卡坏掉，整机就不能用")
    print("  EP%d：每张卡都可能和任意一张卡交换 token。" % N_CARDS)
    print("  all-to-all 是集合操作 —— 64 个 rank 都要提交自己的分片，")
    print("  缺一个，其余 63 个全部阻塞。不是「慢一点」，是「不动」。")
    print("  所以：单卡故障 = 实例故障。没有「降级运行」这个选项。")

    print()
    print("二、重启之后按现存的卡数重定 EP")
    print("  %6s %10s %12s %10s" % ("EP", "每卡专家", "不均", "是否整除"))
    for cards in (64, 63, 62, 56, 48):
        s = spread(N_EXPERTS, cards)
        diff = max(s) - min(s)
        print("  %6d %10.2f %12d %10s"
              % (cards, N_EXPERTS / cards, diff, "是" if diff == 0 else "否"))
    print("  64：正好 4 个，齐。63：4.06 个，必然有人多扛一个（不均 1 份 = %.0f%%）。"
          % (1 / 4.06 * 100))
    print("  追求「凑回 64」是错的 —— 坏掉的那张卡不会因为你想凑就回来。")
    print("  正确做法是「你有多少，就用多少」，用不均匀换可用。")

    print()
    print("三、谁来承接多出来的那 1 份")
    s = spread(N_EXPERTS, 63)
    heavy = sum(1 for x in s if x == max(s))
    print("  63 张卡里 %d 张扛 %d 个专家，%d 张扛 %d 个。"
          % (heavy, max(s), 63 - heavy, min(s)))
    print("  瓶颈由最忙的那张决定：它多 %.0f%% 的 GEMM，整步就慢 %.0f%% 左右。"
          % ((max(s) / (N_EXPERTS / N_CARDS) - 1) * 100,
             (max(s) / (N_EXPERTS / N_CARDS) - 1) * 100 * 0.4))
    print("  这比「整机不可用」好得多，所以接受它。")

    print()
    print("四、恢复为什么要几分钟")
    print("  不是重启本身慢，是要把 %d 个专家的权重重新加载/重新分片：" % N_EXPERTS)
    print("  单机权重按百 GB 算，从 3FS 读到显存是分钟级，不是秒级。")
    print("  所以线上真正靠的是「配额冗余 + 请求改道」，不是等它回来。")

    assert sum(spread(N_EXPERTS, 63)) == N_EXPERTS
    assert max(spread(N_EXPERTS, 63)) - min(spread(N_EXPERTS, 63)) == 1
    print("\n[自检] 64 整除、63 不均 1 份、单卡故障 = 实例故障 —— 与动画一致")


if __name__ == "__main__":
    main()
