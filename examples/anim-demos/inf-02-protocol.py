#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配套脚本 · inf-02 三张面孔，一套内核

对应动画：docs/inf-02-protocol-animation.html

Chat / Responses / Messages 三种请求体，进门先归一成一段对话，
出门再按各自的格式分流回三条流式事件。

这一份实现最小可跑的那一层：
  1. 三种请求 → 同一种内部消息
  2. 内部消息 → 三种增量事件
  3. 归一化过程中会丢什么（这就是「兼容」的真实代价）

    python examples/anim-demos/inf-02-protocol.py
"""
import json


# ── 进门：三种格式 → 一段对话 ─────────────────────────────────────────────
def from_chat(body):
    """POST /v1/chat/completions"""
    return [{"role": m["role"], "text": m["content"]} for m in body["messages"]]


def from_responses(body):
    """POST /v1/responses —— input 可以是字符串，也可以是一串 item"""
    inp = body["input"]
    if isinstance(inp, str):
        return [{"role": "user", "text": inp}]
    out = []
    for it in inp:
        role = it.get("role", "user")
        c = it.get("content")
        if isinstance(c, list):                 # item 里是 block 数组
            text = "".join(b.get("text", "") for b in c
                           if b.get("type") in ("input_text", "text", "output_text"))
        elif isinstance(c, str):
            text = c
        else:
            text = it.get("output_text", "")
        out.append({"role": role, "text": text})
    return out


def from_messages(body):
    """POST /v1/messages —— content 是 block 数组"""
    out = []
    for m in body["messages"]:
        c = m["content"]
        if isinstance(c, str):
            text = c
        else:
            text = "".join(b.get("text", "") for b in c if b["type"] == "text")
        out.append({"role": m["role"], "text": text})
    return out


# ── 出门：内部对话 → 各自的增量事件 ───────────────────────────────────────
def chat_delta(tok):
    return {"object": "chat.completion.chunk",
            "choices": [{"delta": {"content": tok}, "index": 0}]}


def responses_delta(tok):
    return {"type": "response.output_text.delta", "delta": tok}


def messages_delta(tok):
    return {"type": "content_block_delta",
            "delta": {"type": "text_delta", "text": tok}}


def main():
    reqs = {
        "chat":     {"messages": [{"role": "user", "content": "今天晴吗"}]},
        "responses": {"input": [{"role": "user",
                                 "content": [{"type": "input_text", "text": "今天晴吗"}]}]},
        "messages": {"messages": [{"role": "user",
                                   "content": [{"type": "text", "text": "今天晴吗"}]}]},
    }
    fns = {"chat": from_chat, "responses": from_responses, "messages": from_messages}

    print("一、三种请求，归一成同一段对话")
    norm = {}
    for name, body in reqs.items():
        msgs = fns[name](body)
        norm[name] = msgs
        print("  %-9s → %s" % (name, msgs))
    print("  内核只认一种：role + text 的列表。")

    print()
    print("二、同一段对话，分流回三种流")
    for name, fn in (("chat", chat_delta), ("responses", responses_delta),
                     ("messages", messages_delta)):
        print("  %-9s %s" % (name, json.dumps(fn("晴"), ensure_ascii=False)))

    print()
    print("三、归一化会丢什么")
    drops = [
        ("chat", "没有 tools 的 thinking block，只能塞进 content"),
        ("responses", "output_text 之外的 item 没有对应位，只能丢弃或退化"),
        ("messages", "cache_control 这类提示在归一后被抹平"),
    ]
    for name, what in drops:
        print("  %-9s %s" % (name, what))
    print("  所以「三张面孔」不是纯包装：有些字段在归一过程中会消失，")
    print("  这时只能选「丢」或「退化成字符串」—— 两者都不完美，但要选一个并写清楚。")

    print()
    print("四、真正共用的只有内核")
    print("  协议层做的是：字段映射、流式事件拼装、错误码转换。")
    print("  引擎层做的才是：分词、排批、KV、decode。")
    print("  把这两层混在一起，加一种协议就要改一遍引擎 —— 这正是要拆开的原因。")

    assert all(v == [{"role": "user", "text": "今天晴吗"}] for v in norm.values())
    print("\n[自检] 三种格式归一到同一条消息、三种增量事件各就各位 —— 与动画一致")


if __name__ == "__main__":
    main()
