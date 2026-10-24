# Agent Harness（智能体脚手架）资料汇编

> 调研日期：2026-10-24。用途：`docs/hermes-20-harness-build-animation.html`
> 与 `examples/agent-harness-demo/` 的资料底稿。
> 关联集：HERMES 进阶机制 ·06「Harness 脚手架」（宏观图景）；本篇聚焦
> 「一个 Harness 是如何被造出来的」与生产细节。

## 一、定义与共识

**Agent = Model + Harness**。Harness 是模型之外的全部工程层：工具执行、
上下文组装、权限、状态持久化、事件日志、回放与评测。行业共识（2026）：
模型能力趋同，**竞争力来自 harness 工程** —— "LLM 是系统里最小的部分"
（MongoDB）。一个有用的区分（tianpan.co）：

- **Scaffolding（运行前组装）**：system prompt、工具 schema、子 Agent 注册表
- **Harness（运行时）**：循环、状态、权限、日志、恢复

本仓库的对应物：`backend/app/agent/` 即一个迷你 harness（循环 + 工具注册 +
护栏 + 事件），`hermes-18-harness` 讲全景，新集 hermes-20 讲"怎么造"。

## 二、核心来源与关键机制

### 1. Anthropic《Effective harnesses for long-running agents》（2025-11-26）
https://www.anthropic.com/research/effective-harnesses-for-long-running-agents

让 agent 跨多个 context window 连续工作数小时/数天的 harness 要点：

- **两大失败模式**：① one-shot 试图一次做完整个应用 → context 耗尽留半成品；
  ② 过早宣布完工（看到进展就说"完成了"）。
- **两段式 Agent**：initializer（首 session 搭环境）+ coding agent（后续每
  session 只做一个 feature）；两者仅初始 prompt 不同，harness 完全一致。
- **Feature 清单（JSON）**：initializer 把用户需求展开为完整功能列表
  （claude.ai 克隆示例 **200+ 项**），初始全部 `passes: false`；用 JSON 而非
  Markdown——模型更不容易擅自改动；强指令禁止删除/编辑测试条目。
- **Progress 文件 + git log**：新 session 先读这两样快速恢复现状。
- **init.sh**：initializer 写好一键启动脚本，避免每个 session 浪费时间琢磨
  怎么跑。
- **测试门禁**：必须用浏览器自动化（Puppeteer MCP）做端到端验证，才能把
  feature 翻成 `passes: true`。
- **单 session 只做一个 feature** 是关键改动——直接治"做太多"。
- 开源示例：anthropics/claude-quickstarts 的 autonomous-coding 仓库。

### 2. Anthropic《Harness design for long-running application development》（2026-03）
https://www.anthropic.com/engineering/harness-design-long-running-apps
后续工程化文章：把 frontend design skill 与长任务 harness 结合，方法论从
coding 推广到其他领域（科研、金融建模）。

### 3. Harness 解剖（多篇交叉验证的"六大件"）
来源：LangChain《The Anatomy of an Agent Harness》、MongoDB、Parallel.ai、
Addy Osmani《Agent Harness Engineering》：

1. **编排循环**（agent loop：think→act→observe，停止条件）
2. **工具层**（schema、注册表、执行与错误回填）
3. **上下文管理**（系统提示、CLAUDE.md/AGENTS.md、历史压缩、just-in-time 检索）
4. **状态持久化 / checkpoint**（跨 session 恢复、回滚）
5. **事件日志与可观测**（trace 驱动评测与自动改进，Arize 2026-08）
6. **权限与安全**（沙箱、白名单、审批）

### 4. Checkpoint 与安全（2026 新进展）
- **SafeHarness**（arXiv:2604.13630，2026-04）：生命周期安全架构，每 3 个
  执行步骤创建一次 checkpoint，支持回滚到最近可信状态。
- **Context Privilege Escalation Attacks**（2026-09，awesome-harness-engineering
  收录）：首个针对"harness 如何跨源组装上下文"的系统性攻击面分析——
  harness 组上下文的每个来源都可能是注入入口（呼应避坑 05 注入新战场）。
- **Agent Harness Survey**（2026，preprints.org，被引 40+）：首个系统性综述。

## 三、对一个迷你 Harness 的逐步推导（新集与示例的骨架）

从"裸 LLM 调用"出发，每一步补一个真实缺口：

| 步 | 缺口 | 补法 | 本仓库对应 |
|---|---|---|---|
| 0 | 裸调用：只会说不会做，无状态 | — | `examples/01` |
| 1 | 不会动手 | 工具循环 think→act→observe | `ToolRegistry` + `Agent.run` |
| 2 | 死循环烧钱 | 步数/预算/重复三道保险丝 | `Guardrails` |
| 3 | 工具失败即崩溃 | 错误回填为观察，模型自救 | `is_error` ToolResult |
| 4 | 黑盒不可调试 | 事件流 + JSONL trace | `on_event` |
| 5 | 崩了从头再来 | messages 持久化 = 检查点 | `AgentResult.messages` |
| 6 | feature 清单无人验收 | 进度清单 + 测试门禁 | Anthropic 两段式（未来扩展） |

## 四、来源清单（按引用价值排序）

1. Anthropic — Effective harnesses for long-running agents（2025-11-26）
2. Anthropic — Harness design for long-running application development（2026-03）
3. LangChain — The Anatomy of an Agent Harness
4. MongoDB — The Agent Harness: Why the LLM Is the Smallest Part（2026-04）
5. Parallel.ai — What is an agent harness?
6. Addy Osmani — Agent Harness Engineering
7. SafeHarness — arXiv:2604.13630（2026-04，checkpoint 安全架构）
8. tianpan.co — Anatomy of an Agent Harness（2026-02，Scaffolding vs Harness）
9. awesome-harness-engineering（GitHub，含 2026-09 上下文提权攻击分析）
10. HPE Community — Context vs Memory vs Harness Engineering（两段式模式解读）
