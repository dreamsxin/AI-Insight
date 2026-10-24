"""Integration tests for /api/agent endpoints.

LLM is replaced by a scripted FakeLLM via monkeypatching
``app.routers.agent._create_agent`` — no network, no credentials needed.
"""

from __future__ import annotations

import json

import pytest

from app.agent import (
    Agent,
    AgentConfig,
    LLMResponse,
    MaxStepsExceededError,
    ToolCall,
)
from app.agent.teaching_tools import build_teaching_registry
from main import app


class ScriptedLLM:
    """Returns scripted responses in order; records received messages."""

    def __init__(self, scripts: list[LLMResponse]):
        self.scripts = list(scripts)
        self.calls: list[list] = []

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls.append(list(messages))
        idx = min(len(self.calls) - 1, len(self.scripts) - 1)
        return self.scripts[idx]


def _call(cid: str, name: str, **args) -> ToolCall:
    return ToolCall(
        id=cid, name=name, arguments=args,
        raw_arguments=json.dumps(args, ensure_ascii=False),
    )


def _answer(text: str) -> LLMResponse:
    return LLMResponse(content=text, finish_reason="stop", prompt_tokens=10, completion_tokens=5)


def _use_tool(calls: list[ToolCall]) -> LLMResponse:
    return LLMResponse(
        content="", tool_calls=calls, finish_reason="tool_calls",
        prompt_tokens=10, completion_tokens=8,
    )


@pytest.fixture
def install_llm(monkeypatch):
    """Patch the router's agent factory with a scripted LLM; ensure a key exists."""

    def _install(scripts: list[LLMResponse]) -> ScriptedLLM:
        monkeypatch.setenv("LLM_API_KEY", "test-key")
        llm = ScriptedLLM(scripts)

        def factory(req, on_event=None):
            cfg = AgentConfig(
                system_prompt=req.system_prompt or "S",
                max_steps=req.max_steps,
                temperature=req.temperature,
            )
            return Agent(llm, build_teaching_registry(), cfg, on_event=on_event)

        from app.routers import agent as agent_router

        monkeypatch.setattr(agent_router, "_create_agent", factory)
        return llm

    return _install


def test_chat_without_tools_converges(client, install_llm):
    install_llm([_answer("你好，我是教学助手。")])
    resp = client.post("/api/agent/chat", json={"message": "你好"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["output"] == "你好，我是教学助手。"
    assert data["steps"] == 1
    assert data["finish_reason"] == "stop"
    assert data["trace"] == []


def test_chat_with_tool_returns_trace(client, install_llm):
    install_llm([_use_tool([_call("c1", "calculator", expression="17+25")]), _answer("17 加 25 等于 42。")])
    resp = client.post("/api/agent/chat", json={"message": "算 17+25"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["output"] == "17 加 25 等于 42。"
    assert data["steps"] == 2
    kinds = [(s["type"], s["name"]) for s in data["trace"]]
    assert kinds == [("tool_call", "calculator"), ("tool_result", "calculator")]
    result_step = data["trace"][1]
    assert result_step["content"].endswith("42")
    assert result_step["is_error"] is False


def test_tool_error_is_reported_in_trace(client, install_llm):
    # calculator rejects illegal chars; model then answers anyway (scripted)
    install_llm([
        _use_tool([_call("c1", "calculator", expression="__import__('os')")]),
        _answer("这个我不能算。"),
    ])
    resp = client.post("/api/agent/chat", json={"message": "干点坏事"})
    assert resp.status_code == 200
    result_step = resp.json()["trace"][1]
    assert result_step["is_error"] is True
    assert "非法字符" in result_step["content"]


def test_missing_api_key_is_503(client, monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    resp = client.post("/api/agent/chat", json={"message": "hi"})
    assert resp.status_code == 503
    assert resp.json()["detail"]["kind"] == "MissingLLMCredentials"


def test_guard_trip_maps_to_409(client, install_llm):
    # Model keeps calling a tool forever -> MaxStepsExceededError -> 409
    install_llm([_use_tool([_call("c1", "now_utc")])] * 10)
    resp = client.post("/api/agent/chat", json={"message": "ping", "max_steps": 2})
    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["kind"] == "MaxStepsExceededError"


def test_history_is_forwarded(client, install_llm):
    llm = install_llm([_answer("好的")])
    resp = client.post(
        "/api/agent/chat",
        json={
            "message": "继续",
            "history": [
                {"role": "user", "content": "第一问"},
                {"role": "assistant", "content": "第一答"},
            ],
        },
    )
    assert resp.status_code == 200
    # system + 2 history + user
    roles = [m.role.value for m in llm.calls[0]]
    assert roles == ["system", "user", "assistant", "user"]


def test_invalid_body_rejected(client):
    resp = client.post("/api/agent/chat", json={"message": ""})
    assert resp.status_code == 422


def test_stream_emits_events_until_finished(client, install_llm):
    install_llm([_use_tool([_call("c1", "calculator", expression="2+3")]), _answer("2 加 3 等于 5。")])
    events: list[dict] = []
    with client.stream("POST", "/api/agent/chat/stream", json={"message": "算 2+3"}) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        buffer = ""
        for chunk in resp.iter_text():
            buffer += chunk
        for part in buffer.split("\n\n"):
            for line in part.splitlines():
                if line.startswith("data: "):
                    events.append(json.loads(line[len("data: "):]))
    kinds = [e["event"] for e in events]
    assert "tool_call" in kinds and "tool_result" in kinds
    assert kinds[-1] == "finished"
    finished = events[-1]
    assert finished["output"] == "2 加 3 等于 5。"
    tool_result = next(e for e in events if e["event"] == "tool_result")
    assert tool_result["content"].endswith("5")
