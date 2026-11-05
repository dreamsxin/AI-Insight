#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-12 切成两半的字符

对应动画：docs/inf-12-stream-animation.html

后端按 token 发货，前端按 UTF-8 字符收货，两者边界不重合。这一份算：
  1. 一个真的增量解码器：不完整就扣着，缓冲区最多几个字节
  2. 不扣着会怎样（朴素逐块解码的乱码数），以及多等的那一个 TBT
  3. 每块都从头重扫 = 平方级，增量匹配 = 线性，差多少
  4. KMP 打分的跨块进度：`</th` → 4/8，`in` → 6/8
  5. 特殊 token ID 与普通 token 拼出的同样字面量，必须走两条路

    python examples/anim-demos/inf-12-stream.py
"""
import random

TEXT = "今天天气很好，适合出去散步🚀，顺便买杯咖啡☕。"
MARK = "</think>"


def need(b):
    """这个 UTF-8 起始字节后面还差几个字节（含自己）。"""
    if b < 0x80:
        return 1
    if b >> 5 == 0b110:
        return 2
    if b >> 4 == 0b1110:
        return 3
    if b >> 3 == 0b11110:
        return 4
    return 1          # 孤立的续接字节：无法补救，当 1 字节处理


class Incremental:
    """只保留尾部不完整的那个字符，其余立刻吐出去。"""

    def __init__(self):
        self.buf = b""
        self.max_hold = 0

    def feed(self, chunk):
        data = self.buf + chunk
        out, i = [], 0
        while i < len(data):
            n = need(data[i])
            if i + n > len(data):
                break
            out.append(data[i:i + n].decode("utf-8"))
            i += n
        self.buf = data[i:]
        self.max_hold = max(self.max_hold, len(self.buf))
        return "".join(out)


def naive(chunks):
    """不缓冲：每块各自解码，坏的字节直接变成 U+FFFD。"""
    return "".join(c.decode("utf-8", "replace") for c in chunks)


def failure(pat):
    """KMP 的失配表。"""
    f = [0] * len(pat)
    k = 0
    for i in range(1, len(pat)):
        while k and pat[i] != pat[k]:
            k = f[k - 1]
        if pat[i] == pat[k]:
            k += 1
        f[i] = k
    return f


class Matcher:
    """增量匹配器：进度跨 chunk 保留，不回头重扫。"""

    def __init__(self, pat):
        self.pat, self.f, self.k, self.hits = pat, failure(pat), 0, 0

    def feed(self, text):
        for ch in text:
            while self.k and ch != self.pat[self.k]:
                self.k = self.f[self.k - 1]
            if ch == self.pat[self.k]:
                self.k += 1
            if self.k == len(self.pat):
                self.hits += 1
                self.k = self.f[self.k - 1]
        return self.k


def main():
    raw = TEXT.encode("utf-8")

    print("一、一个真的增量解码器")
    jin = len("今".encode("utf-8"))          # 「今」占 3 个字节
    head = raw[:jin + 1]                     # 「今」整字 + 「天」的第 1 个字节
    tail = raw[jin + 1:jin + 3]              # 「天」的第 2、3 个字节
    dec = Incremental()
    print("  chunk 1 = %r  →  吐出 %r，扣着 %r"
          % (head[-6:], dec.feed(head), dec.buf))
    print("  chunk 2 = %r  →  吐出 %r，扣着 %r"
          % (tail, dec.feed(tail), dec.buf))
    print("  `天` = E5 A4 A9：E5 到了但不能单独成字，等 A4 A9 凑齐才交出去。")

    print()
    print("二、缓冲区最多几个字节")
    dec2 = Incremental()
    pieces, rng = [], random.Random(20261021)
    pos = 0
    while pos < len(raw):
        step = rng.choice((1, 2, 3, 5, 7, 11))
        pieces.append(raw[pos:pos + step])
        pos += step
    got = "".join(dec2.feed(p) for p in pieces) + dec2.feed(b"")
    print("  把整段文本按 %d 个随机块切开，逐块喂进去" % len(pieces))
    print("  拼回来的文本与原文一致：%s" % (got == TEXT))
    print("  缓冲区里最多同时存过 %d 个字节；理论最坏 3 个（4 字节字符的 3 个续接字节）。"
          % dec2.max_hold)
    print("  这是个常数，与流多长、切多碎都无关 —— 所以补齐状态可以无脑常驻内存。")

    print()
    print("三、不扣着会怎样")
    bad = naive(pieces)
    print("  朴素逐块解码：%d 个乱码方块（U+FFFD）" % bad.count("\ufffd"))
    print("  这些方块是不可逆的 —— 字节已经丢了，后面收到什么也补不回来。")
    print("  而增量解码只是等下一个 chunk，代价是延迟：")
    for tps in (20, 30, 50, 80):
        print("    %2d token/s → TBT %.0f ms，跨块字符最多晚一个 TBT = %.0f ms"
              % (tps, 1000 / tps, 1000 / tps))
    print("  动画说「宁可晚 20ms」≈ TBT 50 ms 那一档。乱码永远修不好，20ms 没人察觉。")

    print()
    print("四、每块都从头重扫，是平方级")
    tokens, tok_per_chunk, chars_per_tok = 4096, 2, 1.6
    n = tokens // tok_per_chunk
    c = tok_per_chunk * chars_per_tok
    naive_cost = sum(c * i for i in range(1, n + 1))
    linear_cost = n * c
    print("  一个 %d token 的回答，每 %d token 一个 chunk → %d 个 chunk，每块约 %.1f 字符"
          % (tokens, tok_per_chunk, n, c))
    print("  每块重扫已收到的全文：%8.0f 万字符次" % (naive_cost / 10000))
    print("  增量匹配每字符只看一次：%8.0f 字符次" % linear_cost)
    print("  差 %.0f 倍，正好是 chunk 数的一半（n+1）/2 —— 这就是「平方级」长什么样。"
          % (naive_cost / linear_cost))

    print()
    print("五、标记被切开，进度留在原地")
    m = Matcher(MARK)
    for label, chunk in (("chunk 1", "</th"), ("chunk 2", "in"),
                         ("chunk 3", "k>今天…")):
        before = m.hits
        k = m.feed(chunk)
        if m.hits > before:
            print("  %s = %-10r → 进度 8 / 8   命中，切状态" % (label, chunk))
        else:
            print("  %s = %-10r → 进度 %d / %d" % (label, chunk, k, len(MARK)))
    print("  三次喂入之间没有回过头：`</th` 那 4 个字符从来没被重看第二次。")

    print()
    print("六、同样一行字，两种身份")
    SPECIAL_ID = 128821
    path_a = [(SPECIAL_ID, "</think>")]                        # 一个特殊 token
    path_b = [(4711 + i, ch) for i, ch in enumerate("</think>")]  # 8 个普通 token

    def by_id(tokens):
        """解析器只看 token id —— 这正是它该做的。"""
        return "body" if any(tid == SPECIAL_ID for tid, _ in tokens) else "reasoning"

    def by_text(text):
        """反例：只看拼出来的文本。"""
        return "body" if text == "</think>" else "reasoning"

    ta = "".join(t for _, t in path_a)
    tb = "".join(t for _, t in path_b)
    print("  路径 A：1 个特殊 token（id=%d）   拼出的文本 %r" % (SPECIAL_ID, ta))
    print("  路径 B：8 个普通 token（id 4711~）拼出的文本 %r" % tb)
    print("  两串文本一模一样：%s" % (ta == tb))
    print("  按 id 判定 → A 切正文、B 留在思考区：%s / %s" % (by_id(path_a), by_id(path_b)))
    print("  按文本判定 → 两个都切了，B 就被误判：%s / %s" % (by_text(ta), by_text(tb)))
    print("  所以「模型能谈论这个标记，但不能使用它」这条，只能靠 token id 落地。")

    assert got == TEXT
    assert dec2.max_hold <= 3
    assert bad.count("\ufffd") > 0
    assert m.hits == 1
    assert abs(naive_cost / linear_cost - (n + 1) / 2) < 1e-9
    assert ta == tb and by_id(path_a) != by_id(path_b) and by_text(ta) == by_text(tb)
    print("\n[自检] 缓冲 ≤3 字节、跨块进度 4→6→8、重扫差 1024 倍 —— 与动画一致")


if __name__ == "__main__":
    main()
