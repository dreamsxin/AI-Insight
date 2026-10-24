"""教学演示工具集：把 NumPy 计算服务包装成 Agent 可调用的工具。

这些工具让 Playground 形成「AI 调用课程计算引擎」的闭环 —— 与 docs/
AGENT 实战工坊系列的教学思路一致：工具是普通函数，输出保持小而结构化。
"""

from __future__ import annotations

from app.agent import ToolRegistry, tool
from app.services.cnn import PREDEFINED_KERNELS
from app.services.cnn import convolve as cnn_convolve
from app.services.neural_network import forward as nn_forward


def build_teaching_registry() -> ToolRegistry:
    """组装 Playground 默认工具表：计算器 + 时钟 + 两个课程计算工具。"""
    registry = ToolRegistry()

    @tool(registry, description="安全地计算一个数学表达式，只允许数字与运算符")
    def calculator(expression: str) -> str:
        allowed = set("0123456789+-*/()., %")
        if not expression or any(ch not in allowed for ch in expression):
            raise ValueError("表达式包含非法字符，只允许数字与 +-*/().,% ")
        expr = expression.replace(",", "").replace("%", "/100")
        return str(eval(expr, {"__builtins__": {}}, {}))  # noqa: S307 - 字符白名单已挡住调用

    @tool(registry, description="返回当前 UTC 时间的 ISO 字符串")
    def now_utc() -> str:
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()

    @tool(
        registry,
        description=(
            "运行一个固定的全连接网络前向传播（结构 3→4→1，ReLU）。"
            "inputs 必须是恰好 3 个数字，返回最终输出值"
        ),
    )
    def nn_forward_demo(inputs: list[float]) -> dict:
        if len(inputs) != 3:
            raise ValueError(f"该演示网络输入层是 3 个神经元，收到 {len(inputs)} 个")
        result = nn_forward(layers=[3, 4, 1], inputs=inputs, activation="relu")
        return {"output": [round(v, 4) for v in result["output"]]}

    @tool(
        registry,
        description=(
            "对一个 5×5 示例图像做卷积。kernel 从预置核中选一个："
            "edge / blur / sharpen / emboss，返回特征图"
        ),
    )
    def cnn_convolve_demo(kernel: str) -> dict:
        if kernel not in PREDEFINED_KERNELS:
            raise ValueError(f"kernel 仅支持 {sorted(PREDEFINED_KERNELS)}")
        image = [
            [1.0, 2.0, 0.0, 1.0, 2.0],
            [0.0, 1.0, 3.0, 1.0, 0.0],
            [2.0, 1.0, 0.0, 2.0, 1.0],
            [1.0, 0.0, 2.0, 1.0, 3.0],
            [0.0, 2.0, 1.0, 0.0, 1.0],
        ]
        result = cnn_convolve(image=image, kernel=PREDEFINED_KERNELS[kernel])
        output = result["output"] if isinstance(result, dict) else result
        return {"kernel": kernel, "output": output}

    return registry
