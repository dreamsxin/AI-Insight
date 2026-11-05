# 动画配套脚本

每个能动手的动画，配一份可以直接跑的 Python。目标不是「演示一遍」，
而是让屏幕上的数字**你自己能算出来** —— 每份脚本最后都有一行 `[自检]`，
用 `assert` 钉住动画里那个数。

```bash
python examples/anim-demos/inf-30-cache-bytes.py
```

- 依赖：Python 3.10+，只用标准库；只有 `inf-34` 用 numpy
- 确定性：所有随机都带固定种子，跑两遍结果逐位相同
- 对应规则：**脚本名 = 页面名去掉 `-animation.html`**
  `docs/inf-30-cache-bytes-animation.html` ↔ `inf-30-cache-bytes.py`
  所以新增脚本不用维护映射表，重跑 `python docs/tools/demo-gen.py` 即可挂上角标

状态含义：

| 标记 | 含义 |
| :-: | :-- |
| ✓ | 已有脚本，可直接跑 |
| ◐ | 内核可算，排在后面的批次 |
| — | 讲解型：讲的是流程、协议或取舍，脚本只能把画面抄成 print |


## 训练原理 · 模型怎么来的

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ◐ | `tr-01-corpus` | 二十万亿个 token | MinHash 去重、配比、20× 与 285× 的 token 预算 |
| ◐ | `tr-02-parallel` | 一张卡放不下 | 五种切法的通信量与 1F1B 气泡比 |
| ◐ | `tr-03-stability` | 训练为什么不崩 | 112 GB 五份开销、Adam、warmup+cosine |
| ◐ | `tr-04-scaling` | 要多大才够 | 幂律拟合与算力在 N/D 之间的分配 |
| ◐ | `tr-05-alignment` | 从会接话到会做事 | DPO loss、PPO 的 clip、GRPO 的组相对优势 |
| — | `tr-06-ninety-days` | 九十天出厂 | 讲解型 |

## HERMES AGENT 对象拆解

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| — | `hermes-01-architecture` | 多入口架构 | 入口/协议/编排为主，脚本只能复述画面 |
| — | `hermes-02-runtime` | 会话与运行时 | 入口/协议/编排为主，脚本只能复述画面 |
| — | `hermes-mcp` | MCP 自动引导 | 入口/协议/编排为主，脚本只能复述画面 |
| ◐ | `hermes-04-loop` | 主循环消息流 | 假 LLM 跑主循环，看 messages 逐轮生长 |
| ◐ | `hermes-05-slim` | 工具结果瘦身 | 51 万字符网页 → 提取 → 2.3k 摘要 |
| — | `hermes-06-entry` | 新增一个入口 | 入口/协议/编排为主，脚本只能复述画面 |
| — | `hermes-07-batch` | 批量任务 | 入口/协议/编排为主，脚本只能复述画面 |
| — | `hermes-08-memory` | 跨会话记忆 · 前瞻演绎 | 入口/协议/编排为主，脚本只能复述画面 |
| ◐ | `hermes-09-permission` | 权限与安全闸门 | 三层闸门：只读放行 / 写入留痕 / 危险必拦 |
| — | `hermes-10-streaming` | 流式输出 | 入口/协议/编排为主，脚本只能复述画面 |
| ◐ | `hermes-11-recovery` | 错误恢复 | 退避重试 + 熔断，与错误回填的顺序 |
| ◐ | `hermes-12-toolcall` | 工具调用协议 | tool_use / tool_result 配对状态机 |
| ◐ | `hermes-13-context` | 上下文组装 | 五层拼装、静态前置命中缓存、超线裁剪 |
| — | `hermes-14-distributed` | 分布式 Agent | 入口/协议/编排为主，脚本只能复述画面 |
| — | `hermes-15-sandbox` | 沙箱两兄弟 | 入口/协议/编排为主，脚本只能复述画面 |
| — | `hermes-16-sandbox-internals` | 沙箱机制深入 | 入口/协议/编排为主，脚本只能复述画面 |
| ◐ | `hermes-17-gateway` | AI 网关 | 五档路由降级 + 限流记账 |
| ◐ | `hermes-18-cluster` | Agent 集群 | 叫号 + lease，状态外置的交接 |

## HERMES AGENT 进阶机制

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ◐ | `hermes-12-thinking` | 思考预算上链 | think 预算的 token 账：省钱还是买准 |
| ◐ | `hermes-13-skills` | Skills 渐进式披露 | 渐进式披露：名录/正文/细节三层的 token 成本 |
| — | `hermes-14-hooks` | Hooks 生命周期挂点 | 机制讲解，无独立可算量 |
| — | `hermes-16-mcp2026` | MCP 的 2026 演进 | 机制讲解，无独立可算量 |
| — | `hermes-17-a2a` | A2A 与多 Agent 反思 | 机制讲解，无独立可算量 |
| — | `hermes-18-harness` | Harness 脚手架 | 机制讲解，无独立可算量 |
| — | `hermes-19-cua` | CUA 看屏幕点鼠标 | 机制讲解，无独立可算量 |
| — | `hermes-20-harness-build` | 从零造一个 Harness | 机制讲解，无独立可算量 |

## AI 运作原理拆解

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| — | `ai-01-training` | 大模型是怎么炼成的 | 概念对照，数字不构成推理链 |
| ◐ | `ai-02-context-window` | 上下文窗口 | 注意力扫描与「中间遗忘」的位置曲线 |
| ◐ | `ai-03-hallucination` | 幻觉与概率 | 温度如何改变下一个 token 的分布 |
| — | `llm-prompt` | LLM 提示词交互 | 概念对照，数字不构成推理链 |
| — | `agent-loop` | Agent 运作原理 | 概念对照，数字不构成推理链 |
| — | `mcp-cdp` | MCP × Chrome CDP | 概念对照，数字不构成推理链 |
| — | `ai-07-memory` | 记忆管理 | 概念对照，数字不构成推理链 |
| ◐ | `ai-08-rag` | RAG 检索增强 | 切块 + 向量检索 + Top-K 命中 |
| — | `ai-09-multi-agent` | 多 Agent 协作 | 概念对照，数字不构成推理链 |
| ◐ | `ai-10-tokenizer` | 分词 Tokenizer | BPE 从零训练，看合并顺序 |
| ◐ | `ai-11-attention` | 注意力机制 | Q·K → softmax → V 的一步手算 |
| ◐ | `ai-12-sampling` | 采样策略 | top-k / top-p / 温度的三种过滤 |
| — | `ai-13-thinking` | 推理模型与思维链 | 概念对照，数字不构成推理链 |
| ◐ | `ai-14-speed` | 推理加速四件套 | KV / 量化 / 投机 / MoE 四件套的省法拆账 |
| — | `ai-15-diffusion` | 图像扩散模型 | 概念对照，数字不构成推理链 |

## AI 运作原理 · 深入篇

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ◐ | `ai-13-transformer` | Transformer 骨架 | 整条前向：embed → block×N → lm_head |
| ◐ | `ai-14-moe` | 混合专家 MoE | top-k 门控与「6710 亿参数只算 370 亿」 |
| ◐ | `ai-15-kv-cache` | KV Cache 与推理加速 | GQA 与分页：显存占用对比 |
| ◐ | `ai-19-embedding` | Embedding 与向量检索 | 余弦相似度与两阶段检索 |
| ◐ | `ai-17-rlvr` | RLVR 与蒸馏 | 组内相对优势（GRPO）与自动判分 |
| ◐ | `ai-18-finetune` | 微调与 LoRA | LoRA 参数量、秩的选择、merge 前后一致 |
| ◐ | `ai-20-multimodal` | 多模态：眼睛与画笔 | 图片切 patch → token 数的换算 |
| ◐ | `ai-21-moe-routing` | 专家是被逼着分工的 | 偏置只改「选谁」不改「给多少」 |

## LLM 模型算法原理

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ◐ | `llm-01-embedding` | 词向量几何学 | king − man + woman 的向量算术 |
| ◐ | `llm-02-loss` | 损失与学习 | softmax → 交叉熵 → 反传一步 |
| ◐ | `llm-03-position` | 位置编码 | RoPE 旋转，与位置差的点积 |
| ◐ | `llm-04-residual` | 残差与归一化 | 残差梯度通路与 LayerNorm 的统计量 |
| ◐ | `llm-05-vector-poem` | 实例拆解：向量写诗 | 16 维示意向量走完一句诗 |

## 推理原理

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ✓ | `inf-01-overview` | 一个 token 的旅程 | `inf-01-overview.py` |
| ✓ | `inf-02-protocol` | 三张面孔，一套内核 | `inf-02-protocol.py` |
| ✓ | `inf-03-encoding` | 特殊 token 的身份证 | `inf-03-encoding.py` |
| ✓ | `inf-04-two-phase` | 两种性格的机器 | `inf-04-two-phase.py` |
| ✓ | `inf-05-disaggregation` | 拆开才跑得快 | `inf-05-disaggregation.py` |
| ✓ | `inf-06-scheduler` | 别让 GPU 等 CPU | `inf-06-scheduler.py` |
| ✓ | `inf-07-kv-tier` | 缓存金字塔 | `inf-07-kv-tier.py` |
| ✓ | `inf-08-swa-replay` | 只重算 128 个 token | `inf-08-swa-replay.py` |
| ✓ | `inf-09-dspark` | 先猜，再验 | `inf-09-dspark.py` |
| ✓ | `inf-10-eplb` | 专家也会堵车 | `inf-10-eplb.py` |
| ✓ | `inf-11-constrained` | 只能走对的路 | `inf-11-constrained.py` |
| ✓ | `inf-12-stream` | 切成两半的字符 | `inf-12-stream.py` |

## 推理原理 · 第二季

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ✓ |  `inf-13-fp4`  | 四位数够用 | `inf-13-fp4.py` |
| ✓ |  `inf-14-scale-grain`  | 尺子放多细 | `inf-14-scale-grain.py` |
| ✓ |  `inf-15-fp4-where`  | 同一个 4 位，三把尺子 | `inf-15-fp4-where.py` |
| ✓ |  `inf-16-kernel-map`  | 一个 step 的 kernel 账单 | `inf-16-kernel-map.py` |
| ✓ |  `inf-17-mega-moe`  | 三段融成一段 | `inf-17-mega-moe.py` |
| ✓ |  `inf-18-kernel-gap`  | 只差 5% | `inf-18-kernel-gap.py` |
| ✓ |  `inf-19-autoscale`  | 扩看请求，缩看水位 | `inf-19-autoscale.py` |
| ✓ |  `inf-20-grace-period`  | 六十秒搬家 | `inf-20-grace-period.py` |
| ✓ |  `inf-21-ep-failover`  | 一块卡坏掉之后 | `inf-21-ep-failover.py` |
| ✓ |  `inf-22-batch-invariant`  | 同一个输入，同一个输出 | `inf-22-batch-invariant.py` |
| ✓ |  `inf-23-deterministic-sampling`  | 每个序列一个种子 | `inf-23-deterministic-sampling.py` |
| ✓ |  `inf-24-three-ledgers`  | 四道看不见的账 | `inf-24-three-ledgers.py` |

## 推理原理 · 第三季

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ✓ | `inf-25-eval-bench` | 三个基准一台秤 | `inf-25-eval-bench.py` |
| ✓ | `inf-26-pass-at-k` | k 越大越好看 | `inf-26-pass-at-k.py` |
| ✓ | `inf-27-judge-coverage` | 谁说了算，什么时候不算数 | `inf-27-judge-coverage.py` |
| ✓ | `inf-28-yarn` | 位置怎么被拉长 | `inf-28-yarn.py` |
| ✓ | `inf-29-sparse-blocks` | 只算该算的块 | `inf-29-sparse-blocks.py` |
| ✓ | `inf-30-cache-bytes` | 一个 token 的账 | `inf-30-cache-bytes.py` |
| ✓ | `inf-31-cuda-graph` | 一百次发射 | `inf-31-cuda-graph.py` |
| ✓ | `inf-32-metadata-pack` | 装箱单 | `inf-32-metadata-pack.py` |
| ✓ | `inf-33-fused-sampler` | 只留一个 id | `inf-33-fused-sampler.py` |
| ✓ | `inf-34-two-platforms` | 同一形状两种材质 | `inf-34-two-platforms.py` |
| ✓ | `inf-35-numa-bind` | 钉在网卡旁边 | `inf-35-numa-bind.py` |
| ✓ | `inf-36-density` | 一格能装多少 | `inf-36-density.py` |

## AGENT 开发避坑指南

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| — | `dev-01-tools` | 工具设计 | 避坑经验，靠案例不靠计算 |
| ◐ | `dev-02-loop` | 循环失控与成本 | 三道保险丝：步数 / 预算 / 重复检测 |
| ◐ | `dev-03-context` | 上下文工程 | 裁剪、压缩、外置三种处理 |
| — | `dev-04-evals` | 评估与可观测 | 避坑经验，靠案例不靠计算 |
| — | `dev-05-injection` | 注入新战场：工具会下毒 | 避坑经验，靠案例不靠计算 |
| — | `dev-06-evidence-chain` | 证据链：只有文件名不算证据 | 避坑经验，靠案例不靠计算 |
| ◐ | `dev-07-fact-state` | 不知道就说不知道 | 事实三态机与冲突暂停 |

## AGENT 实战工坊 · 知识问答

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ◐ | `rag-01-ingest` | 语料入库 | 切块 + 嵌入 + 20 问自检 |
| ◐ | `rag-02-dialog` | 检索与多轮 | 查询改写 + 检索 + rerank |
| — | `rag-03-ship` | 拒答引用与上线 | 工程选型，无单一可算量 |
| — | `rag-04-selection` | 选题指南 | 工程选型，无单一可算量 |
| — | `rag-04-agentic-rag` | Agentic RAG：会自我纠错的检索 | 工程选型，无单一可算量 |
| — | `rag-05-graphrag` | GraphRAG：把碎片连成地图 | 工程选型，无单一可算量 |

## AGENT 模式进阶

| | 集 | 标题 | 脚本 / 不做的原因 |
| :-: | :-- | :-- | :-- |
| ◐ | `pat-01-plan-execute` | 先谋后动：Plan-and-Execute | Planner 出图、Executor 领单、撞墙回流 |
| ◐ | `pat-02-reflection` | 自我批评：Reflection | 审稿循环的收益递减 |
| — | `pat-03-memory-routing` | 三色文件夹：记忆提取与路由 | 模式对比，同系列其余已可脚本化 |
| ◐ | `pat-04-sliding-window` | 窗口与漏斗：上下文压缩三策略 | 三种压缩策略的保留率 |
| — | `pat-05-mcp-discovery` | 插上 USB：MCP 三角与工具发现 | 模式对比，同系列其余已可脚本化 |
| ◐ | `pat-06-guardrails` | 墙上家规与门上锁：软约束 vs 硬约束 | 策略引擎在代码层拦截 |
| — | `pat-07-agent-relay` | 接力，不是合唱 | 模式对比，同系列其余已可脚本化 |

## 已配脚本的 36 集能自己算出什么

### 第三季（评测、精度与工程）

| 集 | 跑出来对上的数 |
| :-- | :-- |
| `inf-25` | 960 / 1584 / 2500 的分母；99.9 的 Wilson 区间 ±0.28pt，HLE ±1.94pt（差 6.9 倍） |
| `inf-26` | `k=1` 退化成 `c/n`；`c=1` 时 `pass@k = k/32`；`c=31` 时 `k=8` 已必过 |
| `inf-27` | 八条等价规则；960 条 100% 一致；一条覆盖外 → Pass@1 作废 |
| `inf-28` | YaRN 边界 20/45、`mscale(256)=1.5545`、第 0 维不动、最低频压 256× |
| `inf-29` | 15625 块 / 15.3 KB；两级筛取省 248 倍；索引压 1/4 只掉 0.4 个点 |
| `inf-30` | 288 = 256 + 32，528 = 512 + 16；`528 mod 32 = 16`；`lcm = 1056`（2 token） |
| `inf-31` | 11 张图；37 → 40（7.5%）；9 → 16（43.8%）；等比桶平均白算 23.8% |
| `inf-32` | varlen 偏移与 positions；`block_m=8` 浪费 93.8%；UTCCP 映射 4096 全量互逆 |
| `inf-33` | 7 次发射压成 1 次；tag 相关系数 −0.009；行序打乱结果逐位相同 |
| `inf-34` | 30/28 文件、4968/7418 行（1.49×）；顺序求和差 1 ulp，补偿后差 0 |
| `inf-35` | 同插座 25 / 跨插座 12 GB/s；交错排慢 1.64 倍；逻辑 3 → 物理 4 |
| `inf-36` | 301 个 slot；`lcm = 1056`；3FS 可用 512.2 TB → 35.6 张卡；每卡 6.25 GB/s |

### 第二季（四本账）

| 集 | 跑出来对上的数 |
| :-- | :-- |
| `inf-13` | e2m1 的 8 档；2.7 → 3（误差 11%）；小量级不加尺子直接塌成 0 |
| `inf-14` | 4.25 / 4.50 / 8.06 位/元素；per-16 多付 5.9%；`d/128 = 56` 个 int32 |
| `inf-15` | 三个落点各按三个问题判：主 KV 16/e4m3、indexer 32/ue8m0、权重 32/ue8m0 |
| `inf-16` | 11 段合计 100%，计算 71%（26+42+3），其余是搬与等 |
| `inf-17` | 56 MB 中间张量；6 趟 → 2 趟，耗时正好 3 倍 |
| `inf-18` | 26/42/21/11；注意力慢 10% 只值 2.6 个点；3% 优化一倍赚 1.5 |
| `inf-19` | 需求 1000 → 理论 10 台、实际 12 台；0.86 时拒绝缩容 |
| `inf-20` | 40 条 × 3 MB = 120 MB，19 ms 搬完；60 秒 ≈ 2700 token 余量 |
| `inf-21` | 64 整除、63 不均 1 份（4 张扛 5 个专家） |
| `inf-22` | 顺序求和差 3 ulp；构造出真的 top-1 翻面；成对归约差 0 |
| `inf-23` | 三条断言全通过；换 seed 后只偶然重合 1/8 |
| `inf-24` | 四本账互不免费；四层回扣 |

### 第一季（一个 token 的旅程）

| 集 | 跑出来对上的数 |
| :-- | :-- |
| `inf-01` | 500 字 = 11.8s，TTFT 只占 6.8%；60 并发 × 每 22ms 一步 ≈ 2727 token/s |
| `inf-02` | 三种请求归一成同一条消息；三种增量事件各就各位 |
| `inf-03` | 正文编码不含特殊 id、拼接编码含 —— 「谈论」与「使用」的分界 |
| `inf-04` | 屋顶线平衡点 ≈ 295 token；prefill 撞算力、decode 撞带宽 |
| `inf-05` | EP64 → 每卡 4 个专家；4K prompt 的 KV ≈ 6.2 MB，搬它只要 1.0 ms |
| `inf-06` | 单步 240 token；10 万 token 反解成 417 片 |
| `inf-07` | 4K prompt = 32 块；全落 3FS 要 64 ms；三级命中成本差 1000 倍 |
| `inf-08` | 2560 → 128，少算 20 倍；134 个位置 = 1.35 MB/序列；对齐 2688 而非 2560 |
| `inf-09` | 弱草稿 E=1.92 → 白验 62%；好草稿 E=3.49 → 白验 30% |
| `inf-10` | moe_lb = 0.98/0.90 = 1.089；干等 8.2%；两段的窗口都是 10 个 |
| `inf-11` | `^[A-Z]{2}\d{6}$` = 6.76 亿个串 = 29.3 bit；3.2 万/12.8 万 = 25% |
| `inf-12` | 缓冲上限 3 字节；KMP 进度 4→6→8 不回头；重扫成本差 1024 倍 |

## 写一份新脚本的约定

1. 文件名照规则取，落在 `examples/anim-demos/`
2. 头注释写三段：对应哪个动画、跑出来能验证哪几件事、怎么跑
3. 正文只做一件事：把屏幕上的断言算出来，不解释概念（概念在动画里讲）
4. 结尾 `assert` 钉住关键数字，并打一行 `[自检] ... 与动画一致`
5. 随机必须带固定种子 —— 否则「跑两遍一样」这条本身就不可复现
6. 跑完 `python docs/tools/demo-gen.py` 挂角标
