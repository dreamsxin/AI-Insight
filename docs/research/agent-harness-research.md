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

## 五、第二轮调研（2026-10-24 · 面向路线图）

针对「下一步该往 harness 里补什么」做的深化抓取，两篇全文：

### LangChain《The Anatomy of an Agent Harness》（2026-03-10）

- 公式同前：**Agent = Model + Harness**，「如果你不是模型，你就是 harness」。
- **按期望行为逆向设计 harness**（behavior → design）是全文方法论。
- 组件清单：**文件系统 + Git**（最基础原语：持久化、上下文卸载、跨会话账本、
  可回滚分支实验）；**Bash/代码执行**（通用工具，模型自己造工具）；**沙箱**
  （隔离执行、白名单、网络隔离，形成「写码→跑测试→看日志→修错」闭环）；
  **记忆与搜索**（AGENTS.md 持续记忆 + Web Search/MCP 突破知识截止）；
  **对抗 context rot**（compaction、工具输出卸载存文件、Skills 渐进披露）；
  **长时程自主**（规划文件 + hook 跑测试回传错误 + Ralph Loop 拦截提前退出）。
- 硬数字：**仅改 harness，Terminal Bench 2.0 从 52.8% 升至 66.5%**
  （Top 30 → Top 5）；同一 Opus 4.6 在 Claude Code harness 里得分显著低于
  其他 harness。
- 开放问题：数百 agent 并行共享代码库；agent 分析自身 trace 修复 harness；
  按任务动态组装工具与上下文。

### MongoDB《The Agent Harness: Why the LLM Is the Smallest Part》（2026-04）

- **六大组件**：① 状态与持久化（checkpoint/恢复/生命周期管理；等待人工审批
  的暂停 agent 仍在烧基础设施）；② 安全与治理（身份传播、权限范围、审计；
  三大失败模式：工具调用身份未传播→外泄、上下文未消毒→注入、共享系统身份
  →访问控制失准）；③ 编排与工具调用（MCP 只解决连通性，不解决协调/限流/
  沙箱——生产事故多发于此）；④ 记忆（工作记忆 vs 持久存储两级）；⑤ 可观测
  （三信号：输出、推理轨迹、促成决策的记忆与调用）；⑥ 评估（带外运行，
  读可观测数据决定可否部署）。
- **Harness ≠ 平台**：三层成熟度（提示包装器 → 有状态编排 → 治理化机队），
  全球平均 35/100，仅 <1% 超过 50。审计三问：**agent 能否从检查点恢复？
  平台能否产出审计轨迹？能否看到每次行动的成本？**任一「还没有」即未达
  生产标准。
- 硬数字：Claude Code 泄露源码约 **51.2 万行 TS**，模型交互只占极小部分；
  **Vercel 删掉 80% 的工具后成功率 80%→100%、token 减半、延迟 724s→141s**；
  Princeton CORE-Bench 同模型不同 scaffold **42% vs 78%**；Harvey 靠 harness
  优化准确率翻倍。反方证据：Scale AI SWE-Atlas 与 METR 发现部分模型家族对
  harness 不敏感——**harness 收益因模型而异，评估先行**。

### 对路线图的直接推论

1. 「评估/可观测」不是 P2 尾活而是 harness 六大件之一 → trace 落盘与最小
   评估集应升级为独立工作项（对应避坑 04 期方法论）。
2. **工具瘦身审计**有硬数字背书（Vercel 案例）→ 给 `ToolRegistry` 加
   「工具利用率统计」比加新工具更有价值。
3. **checkpoint 恢复 + 审计轨迹 + 单行动成本**三问 = 生产标准自检表 →
   `app.agent` 已有事件流与 messages 序列化，缺「落盘 + 成本标注」。
4. **上下文来源消毒**（MongoDB 失败模式二 / 2026-09 提权攻击）→ 工具结果
   打「数据非指令」标记应进框架层而非提示词层。
5. 长任务两段式（Anthropic）适合作为 **examples 进阶篇**（feature 清单 +
   progress 文件），暂不进框架核心。
