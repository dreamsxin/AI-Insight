#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-35 钉在网卡旁边

对应动画：docs/inf-35-numa-bind-animation.html

「逻辑 3 号卡可能是物理 7 号」这句话，代价是可以算出来的：
  1. 同插座 25 GB/s，跨插座 12 GB/s —— 一条数据多走一趟 QPI
  2. 8 卡 ring all-reduce 的耗时，取决于「谁挨着谁」
  3. 逻辑号到物理号的映射一旦假设成恒等，一半的 hop 会跨插座

    python examples/anim-demos/inf-35-numa-bind.py
"""
N_GPU = 8
PER_SOCKET = 4
BW_LOCAL = 25.0      # GB/s，同插座（PCIe 到本插座的 CPU / 本插座的 HBM）
BW_CROSS = 12.0      # GB/s，跨插座要多走一跳 QPI/UPI
MSG_MB = 100.0


def socket_of(phys):
    return phys // PER_SOCKET


def ring_time(order, mb=MSG_MB):
    """ring all-reduce：每对相邻卡之间搬 2(N-1)/N 倍的消息。"""
    per_hop = mb / 1024.0 * 2 * (N_GPU - 1) / N_GPU     # GB
    total, cross = 0.0, 0
    for i in range(len(order)):
        a, b = order[i], order[(i + 1) % len(order)]
        same = socket_of(a) == socket_of(b)
        bw = BW_LOCAL if same else BW_CROSS
        total += per_hop / bw
        cross += 0 if same else 1
    return total, cross


def main():
    print("一、两档带宽")
    print("  同插座 %.0f GB/s，跨插座 %.0f GB/s —— 差 %.1f 倍"
          % (BW_LOCAL, BW_CROSS, BW_LOCAL / BW_CROSS))
    print("  8 卡两插座，每插座 %d 张。" % PER_SOCKET)

    print()
    print("二、同样的 8 张卡，两种排列")
    layouts = [
        ("按插座排 0 1 2 3 | 4 5 6 7", list(range(8))),
        ("交错排   0 4 1 5 2 6 3 7", [0, 4, 1, 5, 2, 6, 3, 7]),
    ]
    for name, order in layouts:
        t, cross = ring_time(order)
        print("  %-26s 跨插座 %d/8 hop，耗时 %.3f ms" % (name, cross, t * 1000))
    t_ok, _ = ring_time(list(range(8)))
    t_bad, _ = ring_time([0, 4, 1, 5, 2, 6, 3, 7])
    print("  交错排慢 %.2f 倍 —— 每步都付一次，不是一次性的。" % (t_bad / t_ok))

    print()
    print("三、逻辑号不等于物理号")
    mapping = {i: N_GPU - 1 - i for i in range(N_GPU)}
    print("  逻辑 → 物理：%s" % mapping)
    print("  假设成恒等（logical == physical）时，你以为拿到的是插座 0 的前四张，")
    print("  实际拿到的是：%s —— 全在插座 1。"
          % sorted(socket_of(mapping[i]) for i in range(4)))
    naive_cross = sum(1 for i in range(4) if socket_of(i) != socket_of(mapping[i]))
    print("  前四张里 %d 张其实在另一个插座上，绑核绑到了错的地方。"
          % naive_cross)

    print()
    print("四、所以绑定是三件事一起做")
    print("  CPU 亲和  → MPOL_BIND 到本地节点，别让它把页分配到远端")
    print("  网卡亲和  → /sys/class/infiniband/mlx5_*/device/numa_node")
    print("  卡号换算  → 读物理号再算插座，不要信逻辑序")

    assert t_bad > t_ok
    assert mapping[3] == 4, "逻辑 3 号对应物理 4 号"
    print("\n[自检] 交错排更慢、逻辑 3 → 物理 4 —— 与动画一致")


if __name__ == "__main__":
    main()
