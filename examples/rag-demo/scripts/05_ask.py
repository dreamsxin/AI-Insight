# -*- coding: utf-8 -*-
"""
步骤 5 · 问答（CLI）
--------------------
检索式问答：问题 → 向量化 → 余弦 top-k → 带页码引用的证据列表。

  默认「证据模式」：不接 LLM，直接把最相关的原文块连同页码、篇名给出 ——
  对于「静夜思在哪页」「将进酒作者是谁」这类问题，证据本身就是答案。

  可选「LLM 模式」：--llm 时调用 OpenAI 兼容接口，把 top 块塞进 prompt
  生成一个有据可依的回答（需要 OPENAI_API_KEY / OPENAI_BASE_URL / LLM_MODEL 环境变量）。
  检索分数低于 --threshold 时一律拒绝作答（rag-03 期：宁可说不知道）。

运行：
    python scripts/05_ask.py "静夜思的作者是谁"
    python scripts/05_ask.py "疑是地上霜" -k 3
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CJK_RUN = re.compile(r"[\u4e00-\u9fff]+")
CJK_GLUE = re.compile(r"(?<=[\u4e00-\u9fff])[ \t\u3000\r\n]+(?=[\u4e00-\u9fff])")
CIRCLED = re.compile(r"[\u2460-\u2493]")
ASCII_WORD = re.compile(r"[A-Za-z]{2,}")


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for word in ASCII_WORD.findall(text):
        tokens.append(word.lower())
    glued = CJK_GLUE.sub("", CIRCLED.sub("", text))
    for seg in CJK_RUN.findall(glued):
        for ch in seg:
            tokens.append(ch)
        for a, b in zip(seg, seg[1:]):
            tokens.append(a + b)
    return tokens


class Retriever:
    def __init__(self) -> None:
        self.chunks = [json.loads(l) for l in (DATA / "chunks.jsonl").read_text(encoding="utf-8").splitlines()]
        idx = np.load(DATA / "index.npz", allow_pickle=False)
        self.indptr, self.indices, self.data = idx["indptr"], idx["indices"], idx["data"]
        self.idf = idx["idf"]
        self.vocab = {str(w): i for i, w in enumerate(idx["vocab"])}

    def vectorize(self, query: str) -> np.ndarray:
        q = np.zeros(len(self.vocab), dtype=np.float32)
        for tok in tokenize(query):
            j = self.vocab.get(tok)
            if j is not None:
                q[j] += 1.0
        q *= self.idf
        norm = float(np.sqrt((q * q).sum()))
        return q / norm if norm else q

    def search(self, query: str, k: int = 4) -> list[dict]:
        q = self.vectorize(query)
        scores = np.zeros(len(self.chunks), dtype=np.float32)
        for i in range(len(self.chunks)):
            s, e = self.indptr[i], self.indptr[i + 1]
            if e > s:
                scores[i] = float(self.data[s:e] @ q[self.indices[s:e]])
        top = np.argsort(-scores)[:k]
        return [
            {"score": float(scores[i]), **{k2: self.chunks[i][k2] for k2 in ("id", "page_start", "page_end", "printed_page", "poem", "text")}}
            for i in top
        ]


def print_hits(hits: list[dict]) -> None:
    for h in hits:
        poem = h["poem"] or "未识别篇名"
        page = f"PDF 第{h['page_start']}页" + (f"（印刷页码 {h['printed_page']}）" if h["printed_page"] else "")
        snippet = h["text"][:110].replace("\n", " / ")
        print(f"  [{h['score']:.3f}] {poem} · {page}")
        print(f"          {snippet} …")


def main() -> None:
    parser = argparse.ArgumentParser(description="古诗文知识问答（检索式）")
    parser.add_argument("query")
    parser.add_argument("-k", type=int, default=4)
    parser.add_argument("--threshold", type=float, default=0.15, help="低于该分数视为未命中（用 6 个样例查询校准：真实命中 ≥0.158，噪声 ≤0.144）")
    parser.add_argument("--llm", action="store_true", help="用 LLM 生成有据回答（配置方法见 scripts/llm.py 文档）")
    args = parser.parse_args()

    import llm  # 同目录下的 LLM 接入层

    r = Retriever()
    hits = r.search(args.query, k=args.k)
    best = hits[0]["score"] if hits else 0.0
    print(f"问题：{args.query}\n")

    if best < args.threshold:
        print(f"资料中未找到与问题匹配的内容（最高相似度 {best:.3f} < 阈值 {args.threshold}）。")
        print("换个问法试试，或确认语料里确实包含相关内容。—— 宁可说不知道，不可编造。")
        return

    if args.llm:
        if not llm.is_configured():
            print("（未配置 LLM：请设置 OPENAI_API_KEY，或在 examples/rag-demo/.env 写入三行配置；退回证据模式）\n")
            print("证据模式：")
            print_hits(hits)
            return
        print("回答（LLM 依据以下证据生成）：\n")
        try:
            print(llm.grounded_answer(args.query, hits))
        except Exception as exc:  # 网络失败就退回证据模式
            print(f"（LLM 调用失败：{exc}；退回证据模式）\n")
            print_hits(hits)
            return
        print("\n依据（top-k 证据）：")
    else:
        print(f"检索到 {len(hits)} 条最相关内容（证据模式）：")
    print_hits(hits)


if __name__ == "__main__":
    main()
