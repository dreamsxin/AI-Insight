# -*- coding: utf-8 -*-
"""
步骤 2 · 清洗
-------------
这本书的 PDF 由 Acrobat Distiller 9 排版导出，直接提取会混进四类噪音（垃圾进垃圾出）：

  1. 拼音声调字符乱码：注音括号里出现 ch„chŒ、yu‚n 之类 —— 声调符号字体映射错位，
     落在 Unicode 的 \u0080-\u024F 区间（正常中文里不会出现）。
  2. 目录点线：目录页的「桃花源记 ············ 陶渊明（59）」。
  3. 页码行：每页第一行常是纯数字的印刷页码（如「41」）。
  4. 目录页残留：卷首和中卷各有几页目录，行指纹是「数字开头 + 行尾（页码）」，
     如「100 江上渔者 范仲淹（176）」—— 一页内 ≥3 条这种行即整页判定为目录页剔除。
     实测残留目录块会污染检索（词面误配 + 篇名归属被误挂），见 README 踩坑笔记 6。

清洗策略（宁保守不激进，每条规则都能在 README 里对着样例核对）：
  - 删除含乱码字符的整个括号注音：（ch„chŒ） → 删
  - 删除残留的乱码区间字符
  - 连续 3 个以上的「·」点线 → 删
  - 纯数字行 → 从页面元数据里记下第一处作为「印刷页码」，正文里删掉
  - 圈号注码 ①②… 夹在诗句里会切碎原文（疑 / ②是地上霜）→ 删
  - 目录页（≥3 条目录指纹行）→ 整页剔除
  - 压缩多余空白与空行

运行：
    python scripts/02_clean.py
产出：
    data/pages_clean.jsonl   {"page", "printed_page", "text"}
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IN_PATH = ROOT / "data" / "pages.jsonl"
OUT_PATH = ROOT / "data" / "pages_clean.jsonl"

# 乱码高发区：Latin-1 补充区 + 拉丁扩展 A/B（声调拼音被错位映射到这里）
GARBLED = re.compile(r"[\u0080-\u024F]")
# 括号注音里混入乱码 → 整个括号删掉：（ch„chŒ）、(yu‚n)
PAREN_GARBLED = re.compile(r"[（(][^（）()]*[\u0080-\u024F][^（）()]*[)）]")
DOT_LEADERS = re.compile(r"[·•]{3,}")
DIGITS_ONLY = re.compile(r"^\d{1,4}$")
MULTI_SPACE = re.compile(r"[ \t\u3000]+")
# 圈号注码 ①②…⑳ 和 ⑴⒈ 之类：夹在诗句里会把「疑是地上霜」切成「疑 ② 是地上霜」
CIRCLED = re.compile(r"[\u2460-\u2493]")
# 目录行指纹：数字开头 + 行尾（页码），如「100 江上渔者 范仲淹（176）」
TOC_LINE = re.compile(r"^\d{1,3}\s+\S.*（\d{1,3}）\s*$")
# 一页内目录行达到这个数量即整页判定为目录页
TOC_PAGE_MIN_LINES = 3


def clean_page(text: str) -> tuple[str, int | None]:
    printed_page: int | None = None
    kept_lines: list[str] = []
    toc_lines = 0
    for raw in text.splitlines():
        line = DOT_LEADERS.sub("", raw)
        line = PAREN_GARBLED.sub("", line)
        line = GARBLED.sub("", line)
        line = CIRCLED.sub("", line)
        line = MULTI_SPACE.sub(" ", line).strip()
        if not line:
            continue
        if DIGITS_ONLY.match(line):
            # 第一处纯数字行是印刷页码，后面再出现的多是题号/注释序号，一并删
            if printed_page is None:
                printed_page = int(line)
            continue
        if TOC_LINE.match(line):
            toc_lines += 1
            kept_lines.append(line)
            continue
        kept_lines.append(line)

    # 目录页整页剔除（保留 printed_page 元数据以便追溯）
    if toc_lines >= TOC_PAGE_MIN_LINES:
        return "", printed_page

    return "\n".join(kept_lines), printed_page


def main() -> None:
    pages = [json.loads(line) for line in IN_PATH.read_text(encoding="utf-8").splitlines()]
    before_total = sum(len(p["text"]) for p in pages)

    n_pages = 0
    toc_pages: list[int] = []
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for p in pages:
            cleaned, printed_page = clean_page(p["text"])
            if cleaned.strip():
                n_pages += 1
                f.write(json.dumps(
                    {"page": p["page"], "printed_page": printed_page, "text": cleaned},
                    ensure_ascii=False,
                ) + "\n")
            else:
                toc_pages.append(p["page"])

    after_total = sum(len(json.loads(l)["text"]) for l in OUT_PATH.read_text(encoding="utf-8").splitlines())
    print(f"清洗完成：{n_pages} 个非空页")
    if toc_pages:
        print(f"判定为目录页并整页剔除：{toc_pages}")
    print(f"字符数 {before_total} → {after_total}（清掉 {before_total - after_total}，占比 {1 - after_total / before_total:.1%}）")
    sample = json.loads(OUT_PATH.read_text(encoding="utf-8").splitlines()[20])
    print(f"样例（第 {sample['page']} 页 / 印刷页码 {sample['printed_page']}）：")
    print("  " + sample["text"][:100].replace("\n", " / ") + " …")
    print(f"产出 → {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
