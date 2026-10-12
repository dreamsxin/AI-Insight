# -*- coding: utf-8 -*-
"""
步骤 4 · 建索引（离线检索：字符 n-gram TF-IDF）
------------------------------------------------
没有网络、不想装重型依赖也能做检索 —— 用「字符 n-gram + TF-IDF + 余弦相似度」：

  - 中文按「单字 + 二字组」切：静夜思 → 静/夜/思 + 静夜/夜思
    （不装 jieba 也能匹配「夜思」「静夜」这类词，短诗名友好）
  - 英文/数字按小写词切（书里有一些）
  - TF-IDF 加权后 L2 归一化，查询时算余弦相似度

这一步等价于 rag-01 期讲的「嵌入入库」，只是把 embedding 模型换成了
人人可跑的 TF-IDF。想要语义检索（「退钱」命中「退款」），把这里换掉即可，
接口不变（README 有扩展指引）。

运行：
    python scripts/04_index.py
产出：
    data/index.npz   CSR 稀疏矩阵（indptr/indices/data）+ 词表
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
IN_PATH = ROOT / "data" / "chunks.jsonl"
OUT_PATH = ROOT / "data" / "index.npz"

CJK = re.compile(r"[\u4e00-\u9fff]")
ASCII_WORD = re.compile(r"[A-Za-z]{2,}")
CJK_RUN = re.compile(r"[\u4e00-\u9fff]+")
CJK_GLUE = re.compile(r"(?<=[\u4e00-\u9fff])[ \t\u3000\r\n]+(?=[\u4e00-\u9fff])")
CIRCLED = re.compile(r"[\u2460-\u2493]")


def tokenize(text: str) -> list[str]:
    """中文单字 + 二字组；ASCII 词。

    两个细节：
    - 先删圈号注码（①②…），它们会把「疑是地上霜」切碎；
    - 两个中文字符之间的空白/换行直接粘合（中文没有词间空格），
      「床前明月光，\\n疑是地上霜」才能产出「月光」「疑是」这些二元组。
    """
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


def main() -> None:
    chunks = [json.loads(line) for line in IN_PATH.read_text(encoding="utf-8").splitlines()]
    n = len(chunks)

    # 1) 词表 + 每块的词频
    vocab: dict[str, int] = {}
    rows: list[dict[int, int]] = []
    for c in chunks:
        tf: dict[int, int] = {}
        for tok in tokenize(c["text"]):
            j = vocab.setdefault(tok, len(vocab))
            tf[j] = tf.get(j, 0) + 1
        rows.append(tf)

    # 2) IDF
    df = [0] * len(vocab)
    for tf in rows:
        for j in tf:
            df[j] += 1
    idf = np.array([math.log((n + 1) / (d + 1)) + 1.0 for d in df], dtype=np.float32)

    # 3) TF-IDF → CSR 稀疏矩阵（行归一化，点积即余弦）
    indptr = [0]
    indices: list[int] = []
    data: list[float] = []
    for tf in rows:
        js = np.fromiter(tf.keys(), dtype=np.int64)
        vs = np.fromiter(tf.values(), dtype=np.float32) * idf[js]
        norm = float(np.sqrt((vs * vs).sum())) or 1.0
        order = np.argsort(js)
        indices.extend(int(j) for j in js[order])
        data.extend(float(v / norm) for v in vs[order])
        indptr.append(len(indices))

    np.savez(
        OUT_PATH,
        indptr=np.array(indptr, dtype=np.int64),
        indices=np.array(indices, dtype=np.int64),
        data=np.array(data, dtype=np.float32),
        idf=idf,
        vocab=np.array(list(vocab.keys())),  # 定宽 <U 数组，加载无需 allow_pickle
    )

    print(f"索引完成：{n} 块 · 词表 {len(vocab)} 项 · 非零元素 {len(indices)} 个")
    avg_nnz = len(indices) / n
    print(f"平均每块 {avg_nnz:.0f} 个非零项 —— 检索就是一次稀疏点积，毫秒级")
    print(f"产出 → {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
