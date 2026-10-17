"""工具注册表：把普通 Python 函数声明成 Agent 可调用的工具。

设计要点：
- 工具是纯函数，同步/异步都支持；Agent 不关心内部实现
- 参数 schema 可手写，也可从类型注解自动生成（基础类型）
- 工具不知道 LLM 的存在：易测试、可复用、失败可独立重试
"""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from typing import Any, get_args, get_origin, get_type_hints

from app.agent.models import ToolSpec

ToolFn = Callable[..., Any]

# Python 类型 -> JSON Schema 基础映射
_TYPE_MAP: dict[Any, str] = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


class ToolRegistry:
    """工具名 -> 可执行函数 + 规格说明的注册表。"""

    def __init__(self) -> None:
        self._fns: dict[str, ToolFn] = {}
        self._specs: dict[str, ToolSpec] = {}
        self._is_async: dict[str, bool] = {}

    def register(
        self,
        fn: ToolFn,
        *,
        name: str | None = None,
        description: str | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> ToolSpec:
        """注册一个函数为工具；未提供 schema 时从类型注解生成。"""
        tool_name = name or fn.__name__
        if tool_name in self._fns:
            raise ValueError(f"工具名重复注册: {tool_name}")
        doc = (description or inspect.getdoc(fn) or "").strip()
        schema = parameters or build_schema(fn)
        spec = ToolSpec(name=tool_name, description=doc, parameters=schema)
        self._fns[tool_name] = fn
        self._specs[tool_name] = spec
        self._is_async[tool_name] = inspect.iscoroutinefunction(fn)
        return spec

    def has(self, name: str) -> bool:
        return name in self._fns

    def get(self, name: str) -> ToolFn:
        return self._fns[name]

    def is_async(self, name: str) -> bool:
        return self._is_async.get(name, False)

    def specs(self) -> list[ToolSpec]:
        # 稳定顺序：提高前缀缓存命中率（Hermes 16 期：工具顺序也值钱）
        return [self._specs[n] for n in sorted(self._specs)]

    def to_api(self) -> list[dict[str, Any]]:
        """转成 OpenAI tools 字段。"""
        return [
            {
                "type": "function",
                "function": {
                    "name": s.name,
                    "description": s.description,
                    "parameters": s.parameters,
                },
            }
            for s in self.specs()
        ]

    def __len__(self) -> int:
        return len(self._fns)


def tool(
    registry: ToolRegistry,
    *,
    name: str | None = None,
    description: str | None = None,
    parameters: dict[str, Any] | None = None,
) -> Callable[[ToolFn], ToolFn]:
    """装饰器：@tool(registry) 直接把函数注册进表。"""

    def deco(fn: ToolFn) -> ToolFn:
        registry.register(fn, name=name, description=description, parameters=parameters)
        return fn

    return deco


def build_schema(fn: ToolFn) -> dict[str, Any]:
    """从函数签名与类型注解生成最简 JSON Schema（复杂结构建议手写）。"""
    sig = inspect.signature(fn)
    try:
        hints = get_type_hints(fn)
    except Exception:  # noqa: BLE001 - 注解解析失败时退回无类型
        hints = {}

    props: dict[str, Any] = {}
    required: list[str] = []
    for pname, param in sig.parameters.items():
        if pname == "self":
            continue
        ann = hints.get(pname, str)
        props[pname] = {"type": _map_type(ann), "title": pname}
        if param.default is inspect.Parameter.empty:
            required.append(pname)

    schema: dict[str, Any] = {"type": "object", "properties": props}
    if required:
        schema["required"] = required
    return schema


def _map_type(ann: Any) -> str:
    if ann in _TYPE_MAP:
        return _TYPE_MAP[ann]
    origin = get_origin(ann)
    if origin in (list,):
        return "array"
    if origin in (dict,):
        return "object"
    args = get_args(ann)
    if args:
        # Optional[X] / X | None -> X
        return _map_type(args[0])
    return "string"
