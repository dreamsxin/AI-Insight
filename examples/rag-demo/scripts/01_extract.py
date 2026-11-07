# -*- coding: utf-8 -*-
"""
步骤 1 · PDF 逐页提取文本
-------------------------
把《经典古诗文诵读》的语料 PDF（当前为上/下两册）逐页提取为 JSONL，每行一个 JSON：
    {"page": 13, "book": "经典古诗文诵读上", "book_page": 13, "text": "……"}

``page`` 为跨册连续编号（从 1 开始），是下游引用的唯一页码；``book`` 与
``book_page`` 记录它原本属于哪一册、该册的第几页，便于回查纸质书。

为什么逐页而不是整本一个 txt：
  后面每条检索结果都要能给出「出自第几页」，页码就是最简单的引用来源（rag-03 期讲的 citation）。

运行：
    python scripts/01_extract.py            # 需要 PyMuPDF（见 ../requirements.txt）
    python scripts/01_extract.py --check    # 只校验语料发现，不需要第三方依赖
产出：
    data/pages.jsonl   逐页原始文本
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF_PATTERN = "经典古诗文诵读*.pdf"
OUT_PATH = ROOT / "data" / "pages.jsonl"


def discover_pdfs() -> list[Path]:
    """按文件名顺序发现语料（「上」在「下」之前）。"""
    return sorted(ROOT.parent.glob(PDF_PATTERN))


def check() -> int:
    """纯 stdlib 自检：确认语料存在、册序正确，不写任何文件。"""
    pdfs = discover_pdfs()
    if not pdfs:
        print(f"未找到语料：{ROOT.parent / PDF_PATTERN}")
        return 1
    for i, path in enumerate(pdfs, 1):
        print(f"  第 {i} 册：{path.name}")
    print(f"共 {len(pdfs)} 册；输出 → {OUT_PATH.relative_to(ROOT)}")
    return 0


def main() -> None:
    pdfs = discover_pdfs()
    if not pdfs:
        raise SystemExit(f"未找到语料 PDF：{ROOT.parent / PDF_PATTERN}")

    # 延迟导入：--check 可在未安装 PyMuPDF 的环境下运行
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover - 取决于环境
        raise SystemExit(
            "缺少 PyMuPDF：请先执行 pip install -r examples/rag-demo/requirements.txt"
        ) from exc

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    total_pages = 0
    total_chars = 0
    empty_pages: list[int] = []
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for pdf_path in pdfs:
            doc = fitz.open(pdf_path)
            print(f"打开 {pdf_path.name}：共 {doc.page_count} 页")
            for i, page in enumerate(doc):
                total_pages += 1
                # get_text("text") 按阅读顺序输出纯文本，中文 PDF 兼容性好
                text = page.get_text("text")
                total_chars += len(text)
                if len(text.strip()) == 0:
                    empty_pages.append(total_pages)
                record = {
                    "page": total_pages,
                    "book": pdf_path.stem,
                    "book_page": i + 1,
                    "text": text,
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
            doc.close()

    print(
        f"提取完成：{len(pdfs)} 册 / {total_pages} 页，共 {total_chars} 字符，"
        f"平均 {total_chars // total_pages} 字符/页"
    )
    if empty_pages:
        print(f"空白页（跳过即可）：{empty_pages}")
    print(f"产出 → {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="逐页提取《经典古诗文诵读》语料")
    parser.add_argument("--check", action="store_true", help="只校验语料发现，不写文件")
    args = parser.parse_args()
    raise SystemExit(check() if args.check else main() or 0)
