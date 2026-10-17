"""OpenAI Chat Completions 兼容的异步模型客户端。

只用 httpx，不依赖任何官方 SDK —— OpenAI / DeepSeek / 本地 vLLM 只要实现
/chat/completions 即可接入。生产环境请通过环境变量传入 base_url 与 api_key。
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.agent.errors import ValidationError
from app.agent.models import Message, ToolCall
from app.agent.tools import ToolRegistry


@dataclass
class LLMResponse:
    """一次模型响应的结构化结果。"""

    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def wants_tools(self) -> bool:
        return bool(self.tool_calls)


class LLMClient:
    """无状态模型客户端：每次只负责一次 chat.completions 请求。"""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str = "gpt-4o-mini",
        timeout: float = 60.0,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")).rstrip("/")
        self.api_key = api_key if api_key is not None else os.getenv("LLM_API_KEY", "")
        self.model = model
        self.timeout = timeout
        self.extra_headers = headers or {}

    async def chat(
        self,
        messages: list[Message],
        *,
        tools: ToolRegistry | None = None,
        temperature: float = 0.7,
        extra: dict[str, Any] | None = None,
    ) -> LLMResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [m.to_api() for m in messages],
            "temperature": temperature,
        }
        if tools is not None and len(tools):
            payload["tools"] = tools.to_api()
            payload["tool_choice"] = "auto"
        if extra:
            payload.update(extra)

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        headers.update(self.extra_headers)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", json=payload, headers=headers
            )
            resp.raise_for_status()
            data = resp.json()

        return self._parse(data)

    @staticmethod
    def _parse(data: dict[str, Any]) -> LLMResponse:
        try:
            choice = data["choices"][0]
        except (KeyError, IndexError) as exc:
            raise ValidationError(f"模型响应缺少 choices: {data!r}") from exc

        msg = choice.get("message", {})
        content = msg.get("content") or ""
        calls: list[ToolCall] = []
        for raw in msg.get("tool_calls") or []:
            fn = raw.get("function", {})
            raw_args = fn.get("arguments") or "{}"
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
            except json.JSONDecodeError as exc:
                # 模型给了非法 JSON：保留原文，交由上层决定是报错还是回填观察
                raise ValidationError(f"工具参数不是合法 JSON: {raw_args!r}") from exc
            if not isinstance(args, dict):
                raise ValidationError("工具参数必须是 JSON 对象")
            calls.append(
                ToolCall(
                    id=raw.get("id", f"call_{len(calls)}"),
                    name=fn.get("name", ""),
                    arguments=args,
                    raw_arguments=raw_args if isinstance(raw_args, str) else "",
                )
            )

        usage = data.get("usage") or {}
        return LLMResponse(
            content=content,
            tool_calls=calls,
            finish_reason=choice.get("finish_reason", "stop"),
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
            raw=data,
        )
