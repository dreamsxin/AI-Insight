"""通用 Agent 框架测试：用 FakeLLM 离线驱动，无需网络与密钥。

覆盖：
- 工具调用主循环（think→act→observe→收敛）
- 同步/异步工具、schema 自动生成、稳定排序
- 工具报错回填后模型自救
- 护栏：max_steps、token 预算、重复检测、白名单
- 工具结果截断、消息 API 结构
"""

from __future__ import annotations

import pytest

from app.agent import (
    Agent,
    AgentConfig,
    Guardrails,
    MaxStepsExceededError,
    RepeatedCallError,
    Role,
    RunStats,
    ToolRegistry,
    tool,
)
from app.agent.llm import LLMResponse
from app.agent.models import Message, ToolCall
from app.agent.tools import build_schema


# ---------- 测试替身 ----------


class FakeLLM:
    """按脚本依次返回预设响应；记录收到的消息，便于断言。"""

    def __init__(self, scripts: list[LLMResponse]):
        self.scripts = list(scripts)
        self.calls: list[list[Message]] = []
        self.counter = 0

    async def chat(self, messages, *, tools=None, temperature=0.7, extra=None):
        self.calls.append(list(messages))
        idx = min(len(self.calls) - 1, len(self.scripts) - 1)
        return self.scripts[idx]


def call(cid: str, name: str, **args) -> ToolCall:
    import json

    return ToolCall(
        id=cid, name=name, arguments=args, raw_arguments=json.dumps(args, ensure_ascii=False)
    )


def answer(text: str, prompt_tokens: int = 10, completion_tokens: int = 5) -> LLMResponse:
    return LLMResponse(
        content=text, tool_calls=[], finish_reason="stop",
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
    )


def use_tool(calls: list[ToolCall], prompt_tokens: int = 10) -> LLMResponse:
    return LLMResponse(
        content="", tool_calls=calls, finish_reason="tool_calls",
        prompt_tokens=prompt_tokens, completion_tokens=8,
    )


# ---------- 工具与 schema ----------


def test_build_schema_from_annotations():
    def fn(city: str, days: int = 3, flag: bool = False):  # noqa: ANN001
        """天气工具。"""

    schema = build_schema(fn)
    assert schema["type"] == "object"
    assert schema["properties"]["city"]["type"] == "string"
    assert schema["properties"]["days"]["type"] == "integer"
    assert schema["properties"]["flag"]["type"] == "boolean"
    # 只有无默认值的 city 是必填
    assert schema["required"] == ["city"]


def test_registry_register_and_stable_order():
    reg = ToolRegistry()

    @tool(reg)
    def zebra(x: int) -> int:
        return x

    @tool(reg)
    def apple(x: int) -> int:
        return x

    names = [s.name for s in reg.specs()]
    assert names == ["apple", "zebra"]  # 字母序稳定
    api = reg.to_api()
    assert api[0]["type"] == "function"
    assert api[0]["function"]["name"] == "apple"


# ---------- 主循环 ----------


@pytest.mark.asyncio
async def test_agent_runs_tool_then_converges():
    reg = ToolRegistry()

    @tool(reg, description="两数相加")
    def add(a: int, b: int) -> int:
        return a + b

    llm = FakeLLM([
        use_tool([call("c1", "add", a=17, b=25)]),
        answer("17 加 25 等于 42。"),
    ])
    events = []
    agent = Agent(
        llm, reg, AgentConfig(system_prompt="S", max_steps=5),
        on_event=lambda e: events.append(e["event"]),
    )
    result = await agent.run("算 17+25")

    assert result.output == "17 加 25 等于 42。"
    assert result.steps == 2
    assert result.finish_reason == "stop"
    # system / user / assistant(tool) / tool / assistant(answer)
    roles = [m.role for m in result.messages]
    assert roles == [Role.SYSTEM, Role.USER, Role.ASSISTANT, Role.TOOL, Role.ASSISTANT]
    # 工具结果确实是 42 且回填
    tool_msg = result.messages[3]
    assert tool_msg.role == Role.TOOL and tool_msg.content == "42"
    assert tool_msg.tool_call_id == "c1"
    assert "tool_call" in events and "tool_result" in events and "finished" in events


@pytest.mark.asyncio
async def test_async_tool_supported():
    reg = ToolRegistry()

    @tool(reg)
    async def slow_echo(word: str) -> str:
        return f"echo:{word}"

    llm = FakeLLM([
        use_tool([call("c1", "slow_echo", word="hi")]),
        answer("回声是 echo:hi"),
    ])
    agent = Agent(llm, reg, AgentConfig(max_steps=4))
    result = await agent.run("回声 hi")
    assert result.messages[3].content == "echo:hi"


# ---------- 错误自救 ----------


@pytest.mark.asyncio
async def test_tool_error_is_observed_then_recovers():
    reg = ToolRegistry()

    calls = {"n": 0}

    @tool(reg)
    def risky(value: str) -> str:
        calls["n"] += 1
        if calls["n"] == 1:
            raise FileNotFoundError("config.yml")
        return f"ok:{value}"

    llm = FakeLLM([
        use_tool([call("c1", "risky", value="x")]),
        # 第二次改对参数重试
        use_tool([call("c2", "risky", value="y")]),
        answer("成功了：ok:y"),
    ])
    agent = Agent(llm, reg, AgentConfig(max_steps=6))
    result = await agent.run("处理文件")

    err_msg = result.messages[3]
    assert err_msg.role == Role.TOOL
    # 错误被回填且标记 is_error（Message 层通过 name/tool_call_id 体现，内容含 ERROR）
    assert "ERROR" in err_msg.content and "config.yml" in err_msg.content
    assert result.output.startswith("成功了")


@pytest.mark.asyncio
async def test_raise_on_tool_error_propagates():
    from app.agent import ToolExecutionError

    reg = ToolRegistry()

    @tool(reg)
    def boom() -> str:
        raise RuntimeError("boom")

    llm = FakeLLM([use_tool([call("c1", "boom")])])
    agent = Agent(llm, reg, AgentConfig(max_steps=4, raise_on_tool_error=True))
    with pytest.raises(ToolExecutionError):
        await agent.run("引爆")


# ---------- 护栏 ----------


@pytest.mark.asyncio
async def test_max_steps_guard():
    # 模型一直要求调用工具，永不收敛
    reg = ToolRegistry()

    @tool(reg)
    def ping() -> str:
        return "pong"

    llm = FakeLLM([use_tool([call(f"c{i}", "ping")]) for i in range(10)])
    agent = Agent(llm, reg, AgentConfig(max_steps=3))
    with pytest.raises(MaxStepsExceededError):
        await agent.run("一直 ping")


@pytest.mark.asyncio
async def test_repeated_call_guard():
    reg = ToolRegistry()

    @tool(reg)
    def same(x: int) -> int:
        return x

    llm = FakeLLM([use_tool([call(f"c{i}", "same", x=1)]) for i in range(6)])
    agent = Agent(llm, reg, AgentConfig(max_steps=10, max_repeat=2))
    with pytest.raises(RepeatedCallError):
        await agent.run("复读")


def test_guardrails_token_budget():
    g = Guardrails(max_steps=100, max_total_tokens=100)
    stats = RunStats(steps=1, prompt_tokens=80, completion_tokens=30)
    from app.agent import BudgetExceededError

    with pytest.raises(BudgetExceededError):
        g.check_tokens(stats)


def test_guardrails_whitelist():
    reg = ToolRegistry()

    @tool(reg)
    def allowed() -> str:
        return "yes"

    @tool(reg)
    def forbidden() -> str:
        return "no"

    g = Guardrails(allowed_tools={"allowed"})
    g.ensure_tool_allowed("allowed", {s.name for s in reg.specs()})  # 不抛
    with pytest.raises(PermissionError):
        g.ensure_tool_allowed("forbidden", {s.name for s in reg.specs()})


# ---------- 结果截断与消息格式 ----------


@pytest.mark.asyncio
async def test_tool_result_truncation():
    reg = ToolRegistry()

    @tool(reg)
    def big() -> str:
        return "x" * 5000

    llm = FakeLLM([
        use_tool([call("c1", "big")]),
        answer("done"),
    ])
    agent = Agent(llm, reg, AgentConfig(max_steps=4, max_tool_result_chars=100))
    result = await agent.run("取大数据")
    content = result.messages[3].content
    assert len(content) < 400
    assert "结果已截断" in content


def test_message_to_api_shape():
    tc = call("c1", "add", a=1, b=2)
    msg = Message.assistant("思考中", tool_calls=[tc])
    api = msg.to_api()
    assert api["role"] == "assistant"
    assert api["tool_calls"][0]["type"] == "function"
    assert api["tool_calls"][0]["function"]["name"] == "add"
    assert '"a": 1' in api["tool_calls"][0]["function"]["arguments"]
