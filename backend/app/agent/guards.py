"""护栏：在代码层保证 Agent 不失控（不依赖模型自觉）。

对应 docs 动画：
- MaxStepsExceeded：Hermes 02 期 MAX_LOOPS 保险丝
- token 预算：Hermes 02 / 12 期，上下文与思考成本都要封顶
- 重复检测：避坑 02 期 repeat_guard，防温度=0 复读死循环
- 工具白名单：Hermes 09 期最小权限
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from app.agent.errors import (
    BudgetExceededError,
    MaxStepsExceededError,
    RepeatedCallError,
    ToolNotFoundError,
)


@dataclass
class RunStats:
    """一次运行的累计计量。"""

    steps: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    tool_calls: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass
class Guardrails:
    """三道闸的配置与判定（全部在宿主侧强制执行）。"""

    max_steps: int = 10
    max_prompt_tokens: int | None = None
    max_completion_tokens: int | None = None
    max_total_tokens: int | None = None
    max_repeat: int = 3
    # 工具白名单：None 表示允许全部注册工具
    allowed_tools: set[str] | None = None

    _last_sig: str | None = field(default=None, init=False, repr=False)
    _repeat: int = field(default=0, init=False, repr=False)

    def reset(self) -> None:
        self._last_sig = None
        self._repeat = 0

    def check_step(self, stats: RunStats) -> None:
        if stats.steps > self.max_steps:
            raise MaxStepsExceededError(self.max_steps)

    def check_tokens(self, stats: RunStats) -> None:
        if self.max_prompt_tokens and stats.prompt_tokens > self.max_prompt_tokens:
            raise BudgetExceededError("prompt token", stats.prompt_tokens, self.max_prompt_tokens)
        if self.max_completion_tokens and stats.completion_tokens > self.max_completion_tokens:
            raise BudgetExceededError(
                "completion token", stats.completion_tokens, self.max_completion_tokens
            )
        if self.max_total_tokens and stats.total_tokens > self.max_total_tokens:
            raise BudgetExceededError("总 token", stats.total_tokens, self.max_total_tokens)

    def ensure_tool_allowed(self, name: str, registered: set[str]) -> None:
        if name not in registered:
            raise ToolNotFoundError(name)
        if self.allowed_tools is not None and name not in self.allowed_tools:
            # 工具存在但本次运行未授权：按未找到处理（不泄露内部工具表）
            raise PermissionError(f"本次运行未授权工具: {name}")

    def observe_call(self, name: str, arguments: dict) -> None:
        """重复检测：同工具 + 同参数连续出现即计数。"""
        sig = f"{name}:{json.dumps(arguments, ensure_ascii=False, sort_keys=True)}"
        if sig == self._last_sig:
            self._repeat += 1
        else:
            self._last_sig = sig
            self._repeat = 1
        if self._repeat > self.max_repeat:
            raise RepeatedCallError(name, self._repeat, self.max_repeat)
