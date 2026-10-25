# Agent 自我进化与 LLM 优化算法 · 资料汇编

> 调研日期：2026-10-25（三路并行：优化算法 / 自我进化 / 记忆与经验学习）。
> 用途：为 roadmap 补充「Agent 自进化」方向的规划依据。
> 关联：`agent-harness-research.md`（harness 层）、`backend/app/agent/`（可改造对象）。

---

## 一、总框架：什么在进化，谁能进化

**行业公式**：Agent = Model + Harness，进化也分两层——

- **训练层（改权重）**：RLVR、GRPO 系、DPO 系、蒸馏、agent RL。收益真实但需要
  GPU 集群与训练基建，应用团队只能「等 API 红利」（DAPO/VAPO/GSPO 已进入
  ByteDance/Qwen 产品线，on-policy 蒸馏让同价位小模型变强）。
- **harness 层（不改权重）**：反思+经验库、工作流沉淀、技能库（SKILL.md）、
  提示进化（GEPA）、上下文演化（ACE playbook）、进化式候选池。**应用团队当下
  投入产出比最高的主战场**，且 2025–2026 有两个算法锚点（GEPA、ACE）与一条
  重要负结果链（无外部反馈的反思会退化）。

分类框架（Self-Evolving Agents Survey，arXiv:2507.21046，TMLR 2026，v4 2026-01）：
**What to evolve**（prompt/context、memory、tool、workflow、权重）×
**When**（任务内 vs 跨任务）× **How**（标量奖励 vs 文本反馈、自博弈、SFT/DPO/RL）。

---

## 二、训练层：优化算法演进（要点与硬数字）

### RLVR / GRPO 系
修补点高度集中：熵塌缩、长度偏差、样本浪费、MoE 不稳定。
- **DAPO**（字节，2025-03，arXiv:2503.14476）：clip-higher + 动态采样 + token 级
  损失 + 超长塑形；Qwen2.5-32B base AIME24 **50 分**，开源复现起点。
- **VAPO**（字节，2025-04，arXiv:2504.05118）：增强 PPO 证明 value-based 没死，
  AIME24 **60.4**，超 DAPO/R1-Zero 同设置 10+ 分。
- **GSPO**（Qwen，2025-07，arXiv:2507.18071）：序列级重要性比率，治 MoE RL 不稳。
- **TTRL**（2025-04，arXiv:2504.16084，NeurIPS 2025）：**多数投票当奖励**的无标注
  自训练；Qwen2.5-Math-7B AIME24 pass@1 **+211%**。
- **PRM 教训**（Qwen，arXiv:2501.07301）：MC 步级标注噪声大；ORM 已能识别步级
  错误；主流回归「可验证域用规则奖励，PRM 用于数据筛选」。

### 蒸馏：on-policy distillation 是 2025 下半年性价比之王
（Thinking Machines，2025-10-27）：学生自采样、教师逐 token 打反向 KL——
- Qwen3-32B：AIME24 **74.4% / GPQA 63.3% @ 1800 GPU 时**，对比纯 RL 67.6% @
  17900 GPU 时（**约 1/10 成本**）；
- 蒸馏以 **7–10 倍更少梯度步**追平教师，效率约 **50–100 倍**于 RL。
- s1（Stanford，arXiv:2501.19393）：**1000 条**精选轨迹即可让 32B 竞赛数学超
  o1-preview——「少而精 > 大而全」。

### Agent RL 基建
AgentGym-RL（ScalingInter-RL，27 任务无 SFT 冷启动）、AgentRL（异步管线，声称超
GPT-5）、s3（只训 searcher，**2.4k 样本超 70 倍数据基线**）、SkyRL/rLLM/AReaL
（AReaL 异步 2.77 倍加速）。设计模板（容器化环境+结构化轨迹+可验证奖励）值得
harness 借鉴；本仓库 `trace_path` 产出的 JSONL 就是同类原料。

### 效率层（由服务层消化）
BitNet b1.58 2B4T（原生三值权重 2B 开源）、EAGLE-3（6.5 倍）、QuantSpec（Apple，
量化 KV 自投机，接受率 >90%、约 2.5 倍）、NSA 原生稀疏注意力。应用团队唯一
可控点：**前缀缓存友好**（工具顺序稳定、历史只追加）——本仓库已做对。

---

## 三、自我进化：三条产业/算法线

### 线 1 · 自改代码（RSI 谱系）
- **Darwin Gödel Machine**（Sakana，arXiv:2505.22954，ICLR 2026）：自改 agent
  代码，**SWE-bench 20.0%→50.0%**；经验验证 + 达尔文式 archive 防局部最优。
  2026：Sakana 成立 RSI Lab（Schmidhuber 任首席顾问），把 **loop drift 与
  benchmark gaming 列为核心工程问题**。
- **AlphaEvolve**（DeepMind，2025-05）：进化数据库 + 自动评估器；4×4 复矩阵乘
  **48 次**乘法破 Strassen 49 次纪录、Borg 调度回收全球算力 **0.7%**、Gemini
  训练 kernel **提速 23%**。
- 2026 新形态：**SAGE**（四角色共进化 + Critic 防课程漂移，LiveCodeBench
  +8.9%）、**CoEvoSkills**（生成器-验证器共进化沉淀多文件技能包，COLM）、
  **DRQ**（Core War 红皇后对抗共进化，Sakana+MIT）。

### 线 2 · 经验驱动（应用层最相关）
- **AWM**（arXiv:2409.07429，ICML 2025）：从轨迹归纳可复用 workflow 注入后续
  任务——WebArena **相对 +51.1%**、Mind2Web **+24.6%**，**无需训练**。
- **ExpeL**（AAAI 2024）：跨任务对比成败轨迹，蒸馏自然语言 insights。
- **Early Experience**（Meta，arXiv:2510.08558）：无奖励时用自产轨迹做隐式世界
  建模 + 自我反思，反思以**文本回注上下文**——无训练 agent 可直接复制的形态。

### 线 3 · 自博弈自出题（RLVR 路线）
**R-Zero**（Challenger/Solver 共进化，+6.49/+7.54）、**Absolute Zero**（演绎/归纳/
溯因三任务自博弈）、**SPICE**（锚定真实语料，+8.9%/+9.8%）、**MAE**（Proposer/
Solver/Judge）。2026 趋势：**语料锚定 + 可验证奖励 + 防课程漂移**。

---

## 四、记忆与经验学习（2026 产品现状）

- **Mem0**（2026-04 算法升级）：**ADD-only 单遍提取**（写路径省一次 LLM 改写）+
  多信号融合检索 + 时间衰减；LoCoMo 92.5 / LongMemEval 94.4；检索 ~7K tokens
  vs 全上下文 ~26K（3–4 倍省）。
- **Letta 2026 大转向**：记忆从服务器端专用 API 迁到**客户端 + git 管理的文件
  仓（MemFS）**——「bash 即记忆 API，diff 可审可回滚」；提出 memory models
  （模型自己策展记忆才算学习）。sleep-time compute 保持。
- **ChatGPT Dreaming V3**（2026-06）：后台自动总结/刷新记忆页（成本降 5 倍）；
  双轨 = saved memories + reference chat history。
- **Claude**：memory tool（客户端 `/memories` 目录 + CRUD，内部评测 **+39%**，
  token **-84%**）+ Claude Code 双轨（人写 CLAUDE.md / 机写 MEMORY.md）。
- **Anthropic Cookbook 2026-03**：三原语组合标准答案——result clearing（每次
  释放 ~163K tokens）→ compaction（180K 触发，169K→**5.6K**，但默认摘要丢表格
  细节 0/3，必须自定义 instructions）→ memory（跟进会话 4 次读 vs 8 次）。
- **Mem-α**（arXiv:2509.25911）：用 RL 训练「如何管记忆」，≤30K 训练泛化到
  **400K+**（13 倍超训练长度）。
- **评测警示**：LoCoMo 口径混战（Mem0 vs Zep 互相复现打架）→ 行业共识转向
  LongMemEval/BEAM 多基准 + 公开脚本；「没有写明方法的数字是主张，不是结果」。

---

## 五、重要负结果与红线（2025–2026 证据链）

1. **无外部反馈的反思会退化**（arXiv:2310.01798，ICLR 2024，~1646 引用；
   CorrectBench arXiv:2510.16062；Self-Correction Illusion arXiv:2606.05976）：
   纯内省把对的改错。**反思必须接工具结果 / 测试 / 评估器等外部信号**。
2. **经验库有安全暗面**（arXiv:2604.16968，ACL 2026 Findings）：只积累良性任务
   经验也会在高风险场景**降低安全性**（经验是执行导向的）；混合有害经验能减缓
   下滑但导致过度拒绝——「安全-效用权衡」必须显式管理。
3. **自沉淀技能库会固化错误**（Skill Misevolution，arXiv:2608.12851）：需要版本
   历史（git）、定期互评去重、低分归档而非静默覆盖。
4. **进化循环的刷分与漂移**（RHB arXiv:2605.02964、LLMs Gaming Verifiers、
   SAGE 的 Critic）：自动评估器本身是攻击面，需沙盒 + 人工抽检。
5. **单基准 SOTA 叙事破产**（LoCoMo 之争）：多基准 + 公开脚本 + 记录
   延迟/token 成本（LAFS 思路）才是可信口径。

---

## 六、应用层可复制的「越用越好」闭环（无需训练）

按本仓库 `backend/app/agent/` 现状（trace JSONL / eval.py / store.py / SKILL 思路）映射：

| # | 模式 | 原型 | 本仓库落点 |
|---|---|---|---|
| 1 | **反思-经验库**（接外部反馈） | Reflexion/Early Experience | trace JSONL → Reflector 提炼复盘条目入库 → 检索注入 |
| 2 | **GEPA 式提示进化** | GEPA（超 GRPO 6%，rollout 1/35） | eval.py 是现成评估器；外层循环读失败 trace → 变体 system_prompt → 按通过率留 Pareto 前沿 |
| 3 | **ACE 式 playbook 演化** | ACE（AppWorld +10.6%） | Generator=Agent / Reflector=读 trace 提炼 / Curator=结构化 delta 追加进 playbook（防 context collapse），注入 system_prompt |
| 4 | **经验 few-shot 复用** | ACE/AWM | 相似成功轨迹检索为 few-shot；工具利用率审计给出筛选依据 |
| 5 | **复盘→SKILL.md 沉淀** | Anthropic Skills 官方建议 | 同一流程成功 2–3 次 → 沉淀技能文件夹（渐进披露不爆上下文） |
| 6 | **双轨记忆 + 后台策展** | Claude Code / Dreaming V3 | 人写规则与机写记忆分文件；cron 后台去重合并刷新 |
| 7 | **记忆回归集** | LongMemEval 三段分解 | 抽旧会话生成 QA，改动记忆策略后重放 |

**三条红线**：反思必须接外部验证；经验库需安全类条目与过度拒绝监控；进化
循环的评估器按攻击面对待（沙盒 + 抽检）。

---

## 七、主要来源

- DAPO arXiv:2503.14476 · VAPO arXiv:2504.05118 · GSPO arXiv:2507.18071 ·
  TTRL arXiv:2504.16084 · PRM 教训 arXiv:2501.07301 · AReaL arXiv:2505.24298
- On-policy distillation：thinkingmachines.ai/blog/on-policy-distillation ·
  s1 arXiv:2501.19393 · OpenThoughts arXiv:2506.04178
- GEPA arXiv:2507.19457（超 GRPO 6%，DSPy 内置）· ACE arXiv:2510.04618
  （AppWorld +10.6%）· TextGrad arXiv:2406.07496
- AgentGym-RL arXiv:2509.08755 · AgentRL arXiv:2510.04206 · s3 arXiv:2505.14146
- DGM arXiv:2505.22954 · AlphaEvolve（DeepMind 2025-05-14）· Gödel Agent
  arXiv:2410.04444 · SAGE arXiv:2603.15255 · CoEvoSkills arXiv:2604.01687 ·
  DRQ arXiv:2601.03335 · SEAL arXiv:2506.10943
- Self-Evolving Agents Survey arXiv:2507.21046（TMLR 2026）·
  arXiv:2508.07407 · arXiv:2404.14387
- AWM arXiv:2409.07429 · ExpeL arXiv:2308.10144 · Early Experience
  arXiv:2510.08558 · 自纠错退化 arXiv:2310.01798 / 2510.16062 / 2606.05976
- 经验安全暗面 arXiv:2604.16968 · 技能退化 arXiv:2608.12851 · RHB
  arXiv:2605.02964
- Mem0 2026 报告（mem0.ai/blog/state-of-ai-agent-memory-2026）· Letta
  Our Next Phase（2026-03-16）· ChatGPT Dreaming（openai.com，2026-06-04）·
  Anthropic Context Management / Cookbook（2025-09-29 / 2026-03-20）·
  Mem-α arXiv:2509.25911 · AgentFold arXiv:2510.24699
- 评测：LongMemEval arXiv:2410.10813 · LoCoMo 之争（Zep/Mem0 互相复现）
