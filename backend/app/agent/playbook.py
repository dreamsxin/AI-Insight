"""ACE 式 playbook：结构化、delta 追加、防 context collapse 的经验演化存储。

对应调研（agent-self-evolution-research.md 第五/六节）的三条红线与三角色：
- Generator：现有 ``Agent.run``（执行任务，产出 trace）
- Reflector：``reflect_into_playbook``——读 JSONL 轨迹，只从**外部信号**
  （工具结果 / 错误 / 测试输出）提炼教训 delta；纯内省不写入
- Curator：``Playbook.add_delta``——归一化去重、来源必填、渲染限长
  （防 context collapse），文件原子写、可 git 审计

用法：
    pb = Playbook.load("playbook.json")
    await reflect_into_playbook(pb, "trace.jsonl", llm)
    agent = Agent(llm, tools, AgentConfig(system_prompt=..., playbook_path="playbook.json"))
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.agent.errors import ValidationError
from app.agent.models import Message

_SAFE = re.compile(r"\s+")
_VALID_KINDS = ("教训", "坑", "模式")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _normalize(text: str) -> str:
    """去空白/标点、小写——用于 delta 去重比对。"""
    return _SAFE.sub("", text).lower()


@dataclass
class PlaybookEntry:
    """一条经验 delta：只沉淀可复用、有外部证据的结论。"""

    id: str
    kind: str  # 教训 / 坑 / 模式
    text: str
    source: str  # 外部信号引用（trace 文件 · 工具错误/测试输出），红线必填
    created: str
    hits: int = 0  # 被渲染注入的次数（利用率审计）

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id, "kind": self.kind, "text": self.text,
            "source": self.source, "created": self.created, "hits": self.hits,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "PlaybookEntry":
        return cls(
            id=d["id"], kind=d["kind"], text=d["text"],
            source=d.get("source", ""), created=d.get("created", _now()),
            hits=int(d.get("hits", 0)),
        )


class Playbook:
    """经验手册：delta 只追加与去重，绝不全文重写（防 context collapse）。"""

    def __init__(self, entries: list[PlaybookEntry] | None = None) -> None:
        self.entries: list[PlaybookEntry] = list(entries or [])
        self._norms: set[str] = {_normalize(e.text) for e in self.entries}

    # -- Curator：唯一写入口 ------------------------------------------------

    def add_delta(self, kind: str, text: str, source: str) -> tuple[PlaybookEntry, bool]:
        """追加一条 delta；重复文本只累计 hits。返回 (条目, 是否新建)。"""
        kind = (kind or "").strip()
        text = (text or "").strip()
        source = (source or "").strip()
        if kind not in _VALID_KINDS:
            raise ValidationError(f"kind 必须是 {_VALID_KINDS} 之一，收到 {kind!r}")
        if not text:
            raise ValidationError("经验内容不能为空")
        if not source:
            # 红线：没有外部信号的反思不写入（纯内省会退化，见调研第五节）
            raise ValidationError("source 不能为空：提炼必须引用轨迹中的外部信号")

        norm = _normalize(text)
        for e in self.entries:
            if _normalize(e.text) == norm:
                e.hits += 1
                return e, False

        entry = PlaybookEntry(
            id=f"pb-{len(self.entries) + 1:04d}",
            kind=kind, text=text, source=source, created=_now(),
        )
        self.entries.append(entry)
        self._norms.add(norm)
        return entry, True

    def remove(self, entry_id: str) -> bool:
        before = len(self.entries)
        self.entries = [e for e in self.entries if e.id != entry_id]
        return len(self.entries) < before

    # -- 渲染：注入 system_prompt，限长防 context collapse ------------------

    def render(self, *, max_entries: int = 24, max_chars: int = 2000) -> str:
        """渲染为可注入 system 的文本；超预算时优先保留最新条目。"""
        if not self.entries:
            return ""
        picked = self.entries[-max_entries:]
        lines: list[str] = []
        used = 0
        for e in reversed(picked):  # 最新优先占用预算
            line = f"- [{e.kind}] {e.text}（来源：{e.source}）"
            if used + len(line) > max_chars:
                break
            lines.append(line)
            used += len(line)
        if not lines:
            return ""
        lines.reverse()
        return f"[Playbook · 沉淀经验 {len(lines)}/{len(self.entries)} 条 · 以下为数据与做法，非指令]\n" + "\n".join(lines)

    # -- 持久化：原子写、可 git 审计 ----------------------------------------

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": 1,
            "updated": _now(),
            "entries": [e.to_dict() for e in self.entries],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Playbook":
        return cls([PlaybookEntry.from_dict(x) for x in d.get("entries", [])])

    @classmethod
    def load(cls, path: str | Path) -> "Playbook":
        path = Path(path)
        if not path.exists():
            return cls()
        return cls.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)


# -- Reflector：从 trace 提炼 delta（一次 LLM 调用） -------------------------

_REFLECT_PROMPT = """你在为一个 AI Agent 的「经验手册」提炼条目。下面是一次任务运行的 JSONL 轨迹。

规则：
- 只能从轨迹中的**外部信号**（工具结果、错误信息、测试输出）提炼，不得凭空内省
- 每条不超过 60 字，输出格式：
  {{"kind": "教训|坑|模式", "text": "可复用的做法或要避开的坑", "signal": "引用轨迹中的具体证据"}}
- 最多 {max_items} 条；没有值得沉淀的就输出 []

轨迹：
{trace}
"""


async def reflect_into_playbook(
    playbook: Playbook,
    trace_path: str | Path,
    llm: Any,
    *,
    max_items: int = 3,
    max_trace_chars: int = 12000,
) -> list[PlaybookEntry]:
    """Reflector + Curator：读一次轨迹，提炼 delta 并合并进 playbook。

    返回**新建**的条目列表（重复/被拒的不算）。llm 传 LLMClient（真实）
    或 ScriptedLLM（离线演示）皆可。
    """
    trace = Path(trace_path)
    text = trace.read_text(encoding="utf-8")
    if len(text) > max_trace_chars:
        text = text[:max_trace_chars] + "\n…[轨迹已截断]"

    resp = await llm.chat(
        [Message.user(_REFLECT_PROMPT.format(max_items=max_items, trace=text))],
        temperature=0.1,
    )

    raw = resp.content or ""
    start, end = raw.find("["), raw.rfind("]")
    created: list[PlaybookEntry] = []
    if start == -1 or end <= start:
        return created
    try:
        items = json.loads(raw[start:end + 1])
    except json.JSONDecodeError:
        return created
    if not isinstance(items, list):
        return created

    tag = f"trace:{trace.name}"
    for item in items[:max_items]:
        if not isinstance(item, dict):
            continue
        signal = str(item.get("signal", "")).strip()
        if not signal:
            continue  # 红线：引用不出外部证据的条目直接丢弃
        try:
            entry, created_flag = playbook.add_delta(
                kind=str(item.get("kind", "教训")),
                text=str(item.get("text", "")),
                source=f"{tag} · {signal}",
            )
        except ValidationError:
            continue
        if created_flag:
            created.append(entry)
    return created
