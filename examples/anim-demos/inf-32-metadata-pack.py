#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-32 装箱单

对应动画：docs/inf-32-metadata-pack-animation.html

把变长请求摆成规整张量，是每步都要做的活。这一份演示三件事：
  1. varlen 打包：4 条不同长度的请求 → 偏移表 + 位置表（positions 用未压缩序列）
  2. 对齐：block_m 垫到 128，多出来的格子怎么算
  3. CP-mirror：跨卡切分用的转置映射，以及它的逆（必须严格互逆）

    python examples/anim-demos/inf-32-metadata-pack.py
"""
GROUP = 4          # CP 的卡数 / 交错份数
ALIGN = 128


def mirror(m, group=GROUP):
    """把连续编号按 128 一块做转置：块内 (行 m%32, 列 m//32) 互换。"""
    blk, off = divmod(m, 128)
    return blk * 128 + (off % 32) * group + off // 32


def unmirror(m, group=GROUP):
    blk, off = divmod(m, 128)
    return blk * 128 + (off % group) * 32 + off // group


def main():
    # ── 1. varlen 打包 ────────────────────────────────────────────────
    lens = [6, 3, 5, 2]
    print("一、varlen 打包：4 条请求，长度 %s" % lens)
    offs, total = [], 0
    for L in lens:
        offs.append(total)
        total += L
    print("  偏移表  %s   （长度 %d）" % (offs, total))
    print("  槽位     " + " ".join("%4d" % i for i in range(total)))
    print("  属于请求 " + " ".join("%4d" % next(r for r, o in enumerate(offs) if o <= i < o + lens[r])
                                   for i in range(total)))

    print()
    print("  positions 要按「未压缩序列」给，不是槽位下标：")
    pos = [i - offs[next(r for r, o in enumerate(offs) if o <= i < o + lens[r])]
           for i in range(total)]
    print("  槽位 %s" % list(range(total)))
    print("  位置 %s   ← 每条请求都从 0 开始" % pos)
    print("  拿槽位当位置，第 2 条请求的 RoPE 会以为自己在第 6 位，整条序列错位。")

    print()
    print("  长度表给的 %d 也是「每条请求多长」，不是「跑满多少行」。" % total)

    # ── 2. 对齐 ──────────────────────────────────────────────────────
    print()
    print("二、垫到 block_m 的整数倍")
    print("  %8s %8s %8s %8s" % ("block_m", "垫到", "空行", "浪费"))
    for bm in (8, 16, 32, 64, 128):
        padded = (bm + ALIGN - 1) // ALIGN * ALIGN
        print("  %8d %8d %8d %7.1f%%" % (bm, padded, padded - bm, (padded - bm) / padded * 100))
    print("  block_m 越小，垫出来的空行占比越大 —— 这就是小 batch 不划算的原因之一。")

    # ── 3. CP 交错 ───────────────────────────────────────────────────
    print()
    print("三、CP 交错：%d 张卡各领一份，互不重叠" % GROUP)
    toks = list(range(8))
    for r in range(GROUP):
        print("  rank %d 拿 %s" % (r, [t for t in toks if t % GROUP == r]))
    print("  每个 rank 的本地位置 = 全局位置 // %d —— 不是原文，" % GROUP)
    print("  所以还原时要按同一个 stride 插回去，顺序才对。")
    back = [None] * len(toks)
    for r in range(GROUP):
        local = [t for t in toks if t % GROUP == r]
        for li, t in enumerate(local):
            back[r + li * GROUP] = t
    print("  还原 %s" % back)

    # ── 3b. scale 的 UTCCP 布局 ───────────────────────────────────────
    print()
    print("  另一件事：scale 因子按 32×4 转置摆放，为的是让 TMA 连续读 ——")
    print("  公式  (m//128)*128 + (m%32)*4 + (m%128)//32")
    head = list(range(8))
    print("  0–7 map 到 %s" % [mirror(i) for i in head])
    bad = [m for m in range(4096) if unmirror(mirror(m)) != m]
    ok = "全部一致" if not bad else "错 %d 个" % len(bad)
    print("  0–4095 往返：%s；块内 128 个%s" % (ok, "无冲突" if len({mirror(m) for m in range(128)}) == 128 else "有冲突"))
    print("  它是「同一批数的另一种排法」，不改变集合，只改变谁挨着谁。\n")
    # ── 4. -1 与 None ───────────────────────────────────────────────
    print()
    print("四、两种「空」不能混用")
    print("  -1  ：padding 的槽位下标。它不指向任何真实 token，拿去索引会读错。")
    print("  None：待重算的字段。复用上一张图的元数据时必须清成 None，")
    print("        清成 0 不行 —— 0 是合法值（第 0 行、位置 0），下游分不出「没算」和「算了」.")

    assert total == 16
    assert [unmirror(mirror(m)) for m in range(4096)] == list(range(4096))
    assert [back[i] for i in range(8)] == toks
    assert len(set(mirror(m) for m in range(128))) == 128
    print("\n[自检] 16 槽位、4096 全量互逆、块内 128 无冲突 —— 与动画一致")


if __name__ == "__main__":
    main()
