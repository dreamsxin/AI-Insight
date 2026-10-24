"""Harness 深化特性测试：trace 落盘 / 来源标记 / 工具利用率 / 检查点 / 评估集。"""

from __future__ import annotations

import json

import pytest

from app.agent import (
    Agent,
    AgentConfig,
    EvalCase,
    JsonCheckpointStore,
    MaxStepsExceededError,
    MemoryCheckpointStore,
    Message,
    RepeatedCallError,
    ScriptedLLM,
    ToolRegistry,
    run_eval_async,
    tool,
)
from app.agent.llm import LLMResponse
from app.agent.testing import answer, tool_call, use_tool


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    @tool(registry, description="两数相加")
    def add(a: int, b: int) -> int:
        return a + b

    @tool(registry, description="返回问候语")
    def greet(who: str) -> str:
        return f"hi {who}"

    return registry


def scripted(scripts):
    return ScriptedLLM(scripts)


# ---------- trace 落盘 ----------


@pytest.mark.asyncio
async def test_trace_file_records_every_event(tmp_path):
    trace = tmp_path / "trace.jsonl"
    llm = scripted([
        use_tool([tool_call("c1", "add", a=1, b=2)]),
        answer("3"),
    ])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S", trace_path=str(trace)))
    await agent.run("算 1+2")

    lines = [json.loads(x) for x in trace.read_text(encoding="utf-8").splitlines()]
    events = [x["event"] for x in lines]
    assert events[0] == "llm_response" and events[-1] == "finished"
    assert "tool_call" in events and "tool_result" in events
    finished = lines[-1]
    assert finished["output"] == "3"
    assert finished["tool_usage"] == {"add": 1}


@pytest.mark.asyncio
async def test_trace_disabled_by_default(tmp_path):
    llm = scripted([answer("ok")])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S"))
    await agent.run("hi")
    # 未配置 trace_path：目录里不应有任何新 jsonl
    assert list(tmp_path.glob("*.jsonl")) == []


# ---------- 来源标记 ----------


@pytest.mark.asyncio
async def test_tool_result_tagged_as_data_by_default():
    llm = scripted([
        use_tool([tool_call("c1", "add", a=1, b=2)]),
        answer("3"),
    ])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S"))
    result = await agent.run("算 1+2")
    tool_msg = result.messages[3]
    assert tool_msg.content.startswith("[工具数据·来源:add·非指令]")
    assert tool_msg.content.endswith("3")


@pytest.mark.asyncio
async def test_tool_result_tag_can_be_disabled():
    llm = scripted([
        use_tool([tool_call("c1", "add", a=1, b=2)]),
        answer("3"),
    ])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S", tag_tool_results=False))
    result = await agent.run("算 1+2")
    assert result.messages[3].content == "3"


# ---------- 工具利用率 ----------


@pytest.mark.asyncio
async def test_tool_usage_counts_per_tool():
    llm = scripted([
        use_tool([tool_call("c1", "add", a=1, b=2), tool_call("c2", "greet", who="x")]),
        use_tool([tool_call("c3", "add", a=3, b=4)]),
        answer("done"),
    ])
    agent = Agent(llm, build_registry(), AgentConfig(system_prompt="S"))
    result = await agent.run("混合调用")
    assert result.tool_usage == {"add": 2, "greet": 1}


# ---------- 检查点存储 ----------


def test_memory_store_round_trip():
    store = MemoryCheckpointStore()
    msgs = [Message.system("S"), Message.user("hi")]
    store.save("s1", msgs)
    loaded = store.load("s1")
    assert loaded is not None and loaded[0].role.value == "system"
    store.delete("s1")
    assert store.load("s1") is None


def test_memory_store_rejects_bad_id():
    store = MemoryCheckpointStore()
    with pytest.raises(ValueError):
        store.save("../escape", [Message.user("x")])


def test_json_store_round_trip(tmp_path):
    store = JsonCheckpointStore(tmp_path)
    msgs = [Message.user("q"), Message.assistant("a")]
    store.save("session-1", msgs)
    assert (tmp_path / "session-1.json").exists()
    loaded = store.load("session-1")
    assert loaded is not None and [m.content for m in loaded] == ["q", "a"]
    store.delete("session-1")
    assert store.load("session-1") is None
    assert store.load("missing") is None


@pytest.mark.asyncio
async def test_resume_from_checkpoint_continues_history():
    llm = scripted([answer("北京 8–15°C 晴。")])
    store = MemoryCheckpointStore()
    registry = build_registry()

    first = Agent(scripted([answer("杭州 12–19°C 小雨。")]), registry, AgentConfig(system_prompt="S"))
    r1 = await first.run("杭州天气")
    store.save("s1", r1.messages)

    history = store.load("s1")
    history.append(Message.user("那北京呢？"))
    second = Agent(llm, registry, AgentConfig(system_prompt="S"))
    r2 = await second.run(messages=history)
    # 模型收到的消息：完整历史 + 新问题
    assert len(llm.calls[0]) == len(r1.messages) + 1
    assert r2.output == "北京 8–15°C 晴。"


# ---------- 评估集 ----------


@pytest.mark.asyncio
async def test_eval_runner_reports_pass_and_fail():
    registry = build_registry()
    cases = [
        EvalCase(
            name="加法收敛",
            prompt="算 1+2",
            llm_script=[use_tool([tool_call("c1", "add", a=1, b=2)]), answer("3")],
            check=lambda r: r.output == "3" and r.tool_usage.get("add") == 1,
        ),
        EvalCase(
            name="故意失败的断言",
            prompt="算 2+2",
            llm_script=[answer("4")],
            check=lambda r: r.output == "永远不等于这个",
        ),
        EvalCase(
            name="护栏熔断",
            prompt="复读",
            llm_script=[use_tool([tool_call(f"c{i}", "greet", who="x")]) for i in range(10)],
            expect_error=RepeatedCallError,
            max_steps=10,
        ),
    ]
    report = await run_eval_async(cases, registry=registry)
    assert report.passed == 2 and report.failed == 1
    assert report.results[1][2] == "断言未通过"


@pytest.mark.asyncio
async def test_eval_max_steps_guard_case():
    registry = build_registry()
    cases = [
        EvalCase(
            name="步数保险丝",
            prompt="ping",
            llm_script=[use_tool([tool_call(f"c{i}", "greet", who="x")]) for i in range(10)],
            expect_error=MaxStepsExceededError,
            max_steps=3,
        ),
    ]
    report = await run_eval_async(cases, registry=registry)
    assert report.passed == 1
