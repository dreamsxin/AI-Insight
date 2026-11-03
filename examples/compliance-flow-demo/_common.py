"""共享脚手架：案件状态、证据链、门槛检查的纯规则实现。

compliance-flow-demo 的全部"Agent 步骤"都是确定性函数 —— 这组模式
（agent-compliance-patterns-research.md 的 M1–M8）的价值在流程控制：
状态机、闸门、计数、快照。零 LLM 依赖，pytest 可测。
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ---------------- 事实（M3 事实状态机） ----------------

PENDING = "pending"      # 待核
VERIFIED = "verified"    # 已对照来源
CONFLICT = "conflict"    # 来源冲突 → 暂停对外生成


@dataclass
class Fact:
    """一条事实主张及其状态。来源之间冲突即 CONFLICT。"""

    claim: str
    status: str = PENDING
    source: str | None = None   # 可回查的原始来源位置


# ---------------- 材料与附件（M4 证据链 / M5 必需 vs 建议） ----------------

REQUIRED = "required"    # 明确要求：能在原文中定位依据
SUGGESTED = "suggested"  # 模式建议：系统推演，用户决定是否纳入


@dataclass
class Attachment:
    """一份附件。只有文件名不算证据——双字段必填。"""

    filename: str
    content_note: str = ""  # 材料内容说明
    supports: str = ""      # 支持的事实/论点

    def complete(self) -> bool:
        return bool(self.content_note.strip()) and bool(self.supports.strip())


@dataclass
class Material:
    """一项材料。REQUIRED 须附原文摘录；SUGGESTED 可标记本轮不处理。"""

    name: str
    origin: str = SUGGESTED
    excerpt: str | None = None               # REQUIRED 的原文摘录
    attachments: list[Attachment] = field(default_factory=list)
    skipped: bool = False                    # 本轮不处理（仅 SUGGESTED 合法）
    skip_reason: str | None = None

    def ready(self) -> bool:
        """材料完成 = 已附文件且逐件双字段完整。"""
        return bool(self.attachments) and all(a.complete() for a in self.attachments)


# ---------------- 案件（M2 正交维度） ----------------

STANCES = (
    "承认已核实的具体事实",   # → 根因 + 整改
    "争议具体判定",           # → 仅争议事实 + 证据
    "部分承认部分争议",       # → 承认与争议分节
    "仅补件不陈述实体立场",   # → 主体 + 文件说明
    "准备视频核验",           # → 内部准备卡，非对外文稿
)


@dataclass
class Case:
    """案件状态。四个维度字段互相正交、可组合，不是互斥路线。"""

    case_id: str
    topic_types: list[str] = field(default_factory=list)  # 问题类型，可多选
    stage: str = "initial"                                # 处理阶段
    stance: str | None = None                             # 回应立场（只能由用户选定）
    channels: list[str] = field(default_factory=list)     # 提交形式，可多选
    facts: list[Fact] = field(default_factory=list)
    materials: list[Material] = field(default_factory=list)
    rounds: list[dict] = field(default_factory=list)      # M8 快照：append-only


# ---------------- 输出辅助 ----------------

def banner(title: str) -> None:
    print(f"\n{'=' * 58}\n  {title}\n{'=' * 58}")


def bullet(label: str, detail: str = "") -> None:
    line = f"  · {label}"
    if detail:
        line += f" —— {detail}"
    print(line)
