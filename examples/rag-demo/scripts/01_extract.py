# -*- coding: utf-8 -*-
"""
步骤 1 · PDF 逐页提取文本
-------------------------
把《经典古诗文诵读.pdf》逐页提取为 JSONL，每行一个 JSON：
    {"page": 13, "text": "……"}      # page 从 1 开始，对应 PDF 物理页码

为什么逐页而不是整本一个 txt：
  后面每条检索结果都要能给出「出自第几页」，页码就是最简单的引用来源（rag-03 期讲的 citation）。

运行：
    python scripts/01_extract.py
产出：
    data/pages.jsonl   逐页原始文本
"""
from __future__ import annotations

import json
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT.parent / "经典古诗文诵读.pdf"
OUT_PATH = ROOT / "data" / "pages.jsonl"


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF_PATH)
    n = doc.page_count
    print(f"打开 {PDF_PATH.name}：共 {n} 页")

    total_chars = 0
    empty_pages: list[int] = []
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for i, page in enumerate(doc):
            # get_text("text") 按阅读顺序输出纯文本，中文 PDF 兼容性好
            text = page.get_text("text")
            total_chars += len(text)
            if len(text.strip()) == 0:
                empty_pages.append(i + 1)
            f.write(json.dumps({"page": i + 1, "text": text}, ensure_ascii=False) + "\n")
    doc.close()

    print(f"提取完成：{n} 页，共 {total_chars} 字符，平均 {total_chars // n} 字符/页")
    if empty_pages:
        print(f"空白页（跳过即可）：{empty_pages}")
    print(f"产出 → {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
