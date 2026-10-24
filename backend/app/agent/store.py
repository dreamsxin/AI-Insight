"""检查点存储：把 messages 落盘/恢复（Hermes 18 期「会话即事件日志」的最小实现）。

三个生产自检问题之一（MongoDB 六大件）：agent 能否从检查点恢复？
用法：
    store = JsonCheckpointStore("./sessions")
    store.save("s1", result.messages)
    ...
    history = store.load("s1")
    result = await agent.run("继续", messages=history)
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Protocol

from app.agent.models import Message

_SAFE_ID = re.compile(r"^[A-Za-z0-9_\-]{1,128}$")


class CheckpointStore(Protocol):
    """会话检查点存储协议。"""

    def save(self, session_id: str, messages: list[Message]) -> None: ...
    def load(self, session_id: str) -> list[Message] | None: ...
    def delete(self, session_id: str) -> None: ...


def _check_id(session_id: str) -> str:
    if not _SAFE_ID.match(session_id):
        raise ValueError(f"非法 session_id（仅允许字母/数字/_/-，≤128 字符）: {session_id!r}")
    return session_id


class MemoryCheckpointStore:
    """进程内存储：测试与单进程部署。"""

    def __init__(self) -> None:
        self._sessions: dict[str, list[Message]] = {}

    def save(self, session_id: str, messages: list[Message]) -> None:
        self._sessions[_check_id(session_id)] = list(messages)

    def load(self, session_id: str) -> list[Message] | None:
        msgs = self._sessions.get(_check_id(session_id))
        return list(msgs) if msgs is not None else None

    def delete(self, session_id: str) -> None:
        self._sessions.pop(_check_id(session_id), None)


class JsonCheckpointStore:
    """JSON 文件存储：每个会话一个文件，可直接审计与备份。"""

    def __init__(self, directory: str | Path) -> None:
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)

    def _path(self, session_id: str) -> Path:
        return self.dir / f"{_check_id(session_id)}.json"

    def save(self, session_id: str, messages: list[Message]) -> None:
        path = self._path(session_id)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps([m.model_dump() for m in messages], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp.replace(path)  # 原子写，避免崩溃留下半截检查点

    def load(self, session_id: str) -> list[Message] | None:
        path = self._path(session_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return [Message(**m) for m in data]

    def delete(self, session_id: str) -> None:
        self._path(session_id).unlink(missing_ok=True)
