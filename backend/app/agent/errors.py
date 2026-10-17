"""Agent 框架异常体系。

所有异常都带可读的中文/机器信息，便于调用方分类处理（重试 / 上报 / 转人工）。
"""

from __future__ import annotations


class AgentError(Exception):
    """框架异常基类。"""


class ValidationError(AgentError):
    """输入或模型输出不符合约定（如工具参数 JSON 非法）。"""


class ToolNotFoundError(AgentError):
    """模型调用了未注册的工具。"""

    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"工具未注册: {name}")


class ToolExecutionError(AgentError):
    """工具函数自身抛出的错误（已包装原始异常）。"""

    def __init__(self, name: str, original: BaseException) -> None:
        self.name = name
        self.original = original
        super().__init__(f"工具 {name} 执行失败: {original!r}")


class MaxStepsExceededError(AgentError):
    """主循环步数超过上限（对应 Hermes 02 期的 MAX_LOOPS 保险丝）。"""

    def __init__(self, max_steps: int) -> None:
        self.max_steps = max_steps
        super().__init__(f"达到最大步数 {max_steps}，强制停止以防空转烧钱")


class BudgetExceededError(AgentError):
    """token 预算超支。"""

    def __init__(self, kind: str, used: int, limit: int) -> None:
        self.kind = kind
        self.used = used
        self.limit = limit
        super().__init__(f"{kind} 预算超限: 已用 {used} / 上限 {limit}")


class RepeatedCallError(AgentError):
    """连续以完全相同的参数重复调用同一工具，判定为复读死循环。"""

    def __init__(self, name: str, repeat: int, limit: int) -> None:
        self.name = name
        self.repeat = repeat
        self.limit = limit
        super().__init__(f"工具 {name} 连续重复 {repeat} 次（上限 {limit}），疑似死循环")
