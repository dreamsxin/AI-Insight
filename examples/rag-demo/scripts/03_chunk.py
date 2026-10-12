# -*- coding: utf-8 -*-
"""
步骤 3 · 切块
-------------
切块是 RAG 的第一杠杆（rag-01 期）：太小块丢上下文，太大块稀释检索。

本书的特点是「短篇 + 注释」：一首古诗连注释通常 200~600 字。
参数取：块长 350 字、重叠 60 字 —— 一首诗加上要点注释大体在一块里，
跨块的句子两边都有份。没有万能参数，最后用 20 问自检调（见 README）。

同时尽力做「篇章归属」：正文里「20 桃花源记」这样的标题行出现后，
后续块都带上 poem=桃花源记，检索命中时能直接告诉用户篇名。

运行：
    python scripts/03_chunk.py [--chunk 350] [--overlap 60]
产出：
    data/chunks.jsonl   {"id", "page_start", "page_end", "printed_page", "poem", "text"}
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IN_PATH = ROOT / "data" / "pages_clean.jsonl"
OUT_PATH = ROOT / "data" / "chunks.jsonl"

# 篇名标题行，如「20 桃花源记」「39 静 夜 思」—— 书里篇名常有字间空格，
# 允许标题内空白，匹配后再去掉；「尽力而为」的启发式
HEADING = re.compile(r"^(\d{1,3})\s+([\u4e00-\u9fff][\u4e00-\u9fff \u3000·、]{1,24})(\s|$)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunk", type=int, default=350, help="块长（字符）")
    parser.add_argument("--overlap", type=int, default=60, help="重叠（字符）")
    args = parser.parse_args()

    pages = [json.loads(line) for line in IN_PATH.read_text(encoding="utf-8").splitlines()]
    # 拼成 (页码上下文) 序列：每页前插入一个不可见的页标记行，切块时顺带知道页码
    stream: list[tuple[int, int | None, str]] = []
    for p in pages:
        for line in p["text"].split("\n"):
            stream.append((p["page"], p.get("printed_page"), line))

    chunks: list[dict] = []
    current_poem = ""
    buf_lines: list[str] = []
    buf_pages: list[int] = []

    def flush() -> None:
        if not buf_lines:
            return
        text = "\n".join(buf_lines)
        if len(text.strip()) < 30:  # 太碎的块没有检索价值
            return
        chunks.append({
            "id": len(chunks),
            "page_start": min(buf_pages),
            "page_end": max(buf_pages),
            "printed_page": buf_printed,
            "poem": current_poem,
            "text": text,
        })

    buf_printed: int | None = None
    window = args.chunk
    overlap = args.overlap

    for page, printed, line in stream:
        m = HEADING.match(line.strip())
        if m:
            flush()
            buf_lines, buf_pages = [], []
            current_poem = m.group(2).replace(" ", "").replace("\u3000", "")
            buf_printed = printed
            buf_lines.append(line.strip())
            buf_pages.append(page)
            continue
        candidate = f"{chr(10).join(buf_lines)}\n{line}" if buf_lines else line
        if len(candidate) > window and buf_lines:
            flush()
            # 带上尾巴做重叠
            tail = buf_lines[-1][-overlap:] if buf_lines else ""
            buf_lines = [tail] if len(tail) >= overlap // 2 else []
            buf_pages = [buf_pages[-1]] if buf_pages else []
        buf_lines.append(line)
        buf_pages.append(page)
        if printed is not None and buf_printed is None:
            buf_printed = printed
    flush()

    lens = [len(c["text"]) for c in chunks]
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    n_poems = len({c["poem"] for c in chunks if c["poem"]})
    print(f"切块完成：{len(chunks)} 块（chunk={window}, overlap={overlap}），识别出 {n_poems} 个篇名")
    print(f"块长分布：min={min(lens)} / 中位={statistics.median(lens):.0f} / max={max(lens)}")
    print(f"样例块 #{chunks[40]['id']}（第 {chunks[40]['page_start']} 页 · {chunks[40]['poem'] or '未识别篇名'}）：")
    print("  " + chunks[40]["text"][:90].replace("\n", " / ") + " …")
    print(f"产出 → {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
