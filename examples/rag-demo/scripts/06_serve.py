# -*- coding: utf-8 -*-
"""
步骤 6 · Web 问答页（FastAPI + 单文件前端）
-------------------------------------------
把 05_ask.py 的检索能力包成 HTTP 服务：

    python scripts/06_serve.py        # 默认 http://127.0.0.1:8866

  GET  /             检索问答页（ui.html）
  GET  /api/ask?q=…  返回 top-k 证据 JSON（纯检索）
  POST /api/chat     检索 + LLM 有据回答（未配置 Key 自动退回证据模式）
  GET  /api/stats    语料统计

LLM 配置见 scripts/llm.py：环境变量或 examples/rag-demo/.env 三行即可。
"""
from __future__ import annotations

from pathlib import Path

import uvicorn
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module

ask_mod = import_module("05_ask")  # 文件名带数字不能直接 import，走 import_module
import llm  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="古诗文知识问答 Demo")
retriever = ask_mod.Retriever()
THRESHOLD = 0.15  # 与 05_ask.py / ui.html 保持一致：6 个样例查询校准值


class ChatReq(BaseModel):
    question: str
    k: int = 4


@app.get("/")
def index() -> FileResponse:
    return FileResponse(ROOT / "ui.html")


@app.get("/api/stats")
def stats() -> dict:
    poems = {c["poem"] for c in retriever.chunks if c["poem"]}
    return {
        "chunks": len(retriever.chunks),
        "poems": len(poems),
        "pages": max(c["page_end"] for c in retriever.chunks),
        "llm_configured": llm.is_configured(),
    }


def _pack_hits(hits: list[dict]) -> list[dict]:
    return [
        {
            "score": round(h["score"], 4),
            "poem": h["poem"] or "未识别篇名",
            "page_start": h["page_start"],
            "printed_page": h["printed_page"],
            "text": h["text"],
        }
        for h in hits
    ]


@app.get("/api/ask")
def ask(q: str = Query(min_length=1), k: int = Query(default=4, ge=1, le=10)) -> dict:
    hits = retriever.search(q, k=k)
    return {"query": q, "hits": _pack_hits(hits)}


@app.post("/api/chat")
def chat(req: ChatReq) -> dict:
    """检索 → 拒答闸门 → LLM 有据回答（未配置 Key 退回证据模式）。"""
    hits = retriever.search(req.question, k=req.k)
    packed = _pack_hits(hits)
    best = hits[0]["score"] if hits else 0.0

    if best < THRESHOLD:
        return {"mode": "refuse", "best_score": round(best, 4), "hits": packed}
    if llm.is_configured():
        try:
            answer = llm.grounded_answer(req.question, hits)
            return {"mode": "llm", "answer": answer, "hits": packed}
        except Exception as exc:  # 网络/额度等任何失败，都退回证据模式
            return {
                "mode": "evidence",
                "error": f"LLM 调用失败（{exc.__class__.__name__}），已退回证据模式",
                "hits": packed,
            }
    return {"mode": "evidence", "hits": packed}


if __name__ == "__main__":
    print("古诗文知识问答 Demo → http://127.0.0.1:8866")
    print(f"LLM：{'已配置（/api/chat 生成有据回答）' if llm.is_configured() else '未配置（证据模式；配置方法见 README 步骤 7）'}")
    uvicorn.run(app, host="127.0.0.1", port=8866, log_level="warning")
