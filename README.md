# AI-Insight · AI原理可视化

> **洞见AI** — 看见神经网络的内部世界

仓库由三部分组成：

1. **交互式课程应用** — Python(FastAPI) + TypeScript(Vite) + 原生 Canvas API 的 AI 原理可视化教程，用数据流动画和直观比喻让不懂数学公式的人也能理解 AI 原理。
2. **运作动画演示库（`docs/`）** — 12 个系列、103 集自包含逐屏动画，覆盖训练原理、模型原理、推理服务到 Agent 工程的完整知识地图，是仓库目前最主要的产出。
3. **通用 Agent 框架（`backend/app/agent/`）** — 零 LLM-SDK 依赖、可用于生产的异步 Agent 运行时，其设计正取自动画系列沉淀的工程共识。

## 📚 课程内容

| 章 | 标题 | 核心可视化 |
|---|------|-----------|
| 1 | 从函数到神经网络 | 函数图、激活函数对比、神经元构建 |
| 2 | 计算神经网络的参数 | 网络结构图、前向传播动画、矩阵乘法 |
| 3 | 调教神经网络的方法 | 损失函数、梯度下降、反向传播 |
| 4 | 从矩阵到CNN | 图像矩阵、卷积操作、特征图、池化 |
| 5 | 从RNN到Transformer | RNN序列展开、注意力概念 |
| 6 | Transformer 简单而强大 | Self-Attention、多头注意力、位置编码 |
| 7 | 鸟瞰 Transformer | 完整架构图、Encoder拆解、数据流 |
| 8 | 文字的向量化 | 分词、Embedding流水线、向量空间 |
| 9 | 速通大模型100词 | 100术语网格、详情卡片 |

## 🎬 运作动画演示（docs/）

`docs/index.html` 是唯一入口，收录 **12 个系列、103 集**（无孤儿文件）：

| 系列 | 期数 | 主题 |
|---|---|---|
| 训练原理 · 模型怎么来的 | 6 | 语料流水线、并行分片、训练稳定性、scaling law、后训练 |
| HERMES AGENT 对象拆解 | 18 | 多入口架构、主循环、MCP、权限、流式、错误恢复…… |
| HERMES AGENT 进阶机制 | 7 | 思考预算、Skills 渐进披露、Hooks、沙箱、A2A、Harness、CUA |
| AI 运作原理拆解 | 15 | 训练三部曲、上下文窗口、注意力、采样、多 Agent…… |
| AI 运作原理 · 深入篇 | 8 | Transformer 骨架、MoE、KV Cache、RLVR、LoRA、Embedding、多模态 |
| LLM 模型算法原理 | 5 | 词向量、损失、位置编码、残差、向量注意力 |
| 推理原理（三季） | 27 | 服务层（prefill/decode、KV 三级缓存、推测解码）→ 底层账本 → 第三季持续更新 |
| AGENT 开发避坑指南 | 5 | 工具设计、循环成本、上下文工程、评估观测、提示注入 |
| AGENT 实战工坊 | 6 | 知识问答 RAG 全链路：入库 → 检索多轮 → 上线 → 选型 → Agentic RAG → GraphRAG |
| AGENT 模式进阶 | 6 | Plan-and-Execute、Reflection、CoALA 记忆、MCP 发现、护栏 |

**打开方式**（每集单文件零依赖，含上/下集导航与检索）：

```bash
python -m http.server 8899 --directory docs
# 浏览 http://localhost:8899 ，或直接双击任一 html
```

规划与审计文档见 `docs/research/`（推理原理第三季规划书、覆盖审计等）；`docs/tools/nav-gen.py` 负责生成集间导航。

## 🤖 通用 Agent 框架（backend/app/agent/）

生产级异步 Agent 运行时：`think → act → observe` 主循环，**模型只有提案权、执行在宿主**；工具即普通函数；护栏（步数 / token 预算 / 重复检测 / 白名单）全部在代码层强制；全链路结构化事件可观测。走 OpenAI Chat Completions 兼容协议，OpenAI / DeepSeek / 本地 vLLM 均可接入，仅依赖 `httpx`。

```python
import asyncio
from app.agent import Agent, AgentConfig, LLMClient, ToolRegistry, tool

registry = ToolRegistry()

@tool(registry, description="两数相加")
def add(a: int, b: int) -> int:
    return a + b

agent = Agent(
    LLMClient(base_url="https://api.deepseek.com/v1", api_key="sk-...", model="deepseek-chat"),
    registry,
    AgentConfig(system_prompt="你是计算助手。", max_steps=6),
    on_event=lambda e: print(e["event"]),   # 可选：逐步观测
)

result = asyncio.run(agent.run("帮我算 17 加 25"))
print(result.output, result.steps)
```

凭证经环境变量注入：`LLM_BASE_URL`（默认 OpenAI）、`LLM_API_KEY`。完整文档（模块地图、生产检查清单、设计出处）见 [`backend/app/agent/README.md`](backend/app/agent/README.md)。

## 🏗️ 技术架构

```
浏览器 (前端)                         Python 后端 (FastAPI)
┌──────────────────┐                 ┌──────────────────────┐
│ 章节导航 Sidebar  │   HTTP /api    │ 章节内容 API          │
│ Canvas 可视化引擎 │ ←───────────→  │ 计算引擎 (NumPy)     │
│ 交互控制面板      │                │ 100术语库            │
└──────────────────┘                 │ Agent 框架 (app/agent)│
                                     └──────────────────────┘
TypeScript + Vite                    Python + FastAPI + NumPy + httpx
```

### 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI | 异步、自动OpenAPI文档 |
| 后端计算 | NumPy | 神经网络/卷积/注意力计算 |
| Agent 框架 | httpx + Pydantic v2 | OpenAI 兼容协议，无官方 SDK 依赖 |
| 前端构建 | Vite | 极速HMR |
| 前端语言 | TypeScript (strict) | 类型安全 |
| 可视化 | 原生 Canvas 2D API | 自研轻量渲染引擎（`three` 仅 3 处使用） |
| 后端测试 | pytest + pytest-asyncio | 43 个测试（含 Agent 框架 12 个离线测试） |
| 前端测试 | Vitest | 25个测试 |

## 🚀 快速开始

### 环境要求

- Python 3.10+（注意：全新安装时 `requirements.txt` 的 `numpy>=2.3.0` 需要 Python 3.11+；Python 3.10 环境请先自行安装 `numpy~=2.2` 再装其余依赖）
- Node.js 18+

### 一键启动

**Windows:**
```bash
start.bat
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

### 手动启动

**1. 启动后端**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**2. 启动前端**
```bash
cd frontend
npm install
npm run dev
```

**3. 访问**
- 前端: http://localhost:5173
- API文档: http://localhost:8000/docs
- 动画索引: `python -m http.server 8899 --directory docs` → http://localhost:8899

## 📁 项目结构

```
AI-Insight/
├── backend/                  # Python FastAPI 后端
│   ├── main.py              # 入口（router 注册处）
│   ├── app/
│   │   ├── agent/           # 通用 Agent 框架（主循环/工具/护栏/LLM客户端）
│   │   ├── models/          # Pydantic 数据模型
│   │   ├── data/            # 章节内容 + 100术语
│   │   ├── routers/         # API路由 (chapters/compute/terms)
│   │   ├── services/        # NumPy计算引擎 (NN/CNN/Transformer)
│   │   └── tests/           # pytest测试 (43个)
│   └── requirements.txt
├── frontend/                 # TypeScript Vite 前端
│   ├── src/
│   │   ├── canvas/           # 自研Canvas渲染引擎
│   │   │   ├── engine/       # Renderer, Scene, AnimationLoop
│   │   │   ├── shapes/       # Circle, Rect, Line, Text, Arrow...
│   │   │   └── animation/    # Tween, Easing, Timeline
│   │   ├── components/       # UI组件 (Sidebar, ControlsPanel...)
│   │   ├── core/             # App, Router, EventBus
│   │   ├── api/              # fetch 封装 (client/chapters/compute)
│   │   ├── visualizations/   # 每章可视化实现 (ch01 ~ ch09)
│   │   └── utils/            # 数学/颜色工具
│   └── tests/                # Vitest测试 (25个)
├── docs/                     # 103 集动画演示库（独立于 Vite 应用）
│   ├── index.html            # 唯一入口：12 系列 + 检索 + 知识地图
│   ├── research/             # 系列规划书与审计报告
│   ├── tools/                # nav-gen.py 集间导航生成器
│   └── vendor/               # three.js r160（file:// 直开改写版）
├── examples/                 # RAG 实战工坊配套示例（rag-demo）
├── start.bat                 # Windows一键启动
├── start.sh                  # Linux/Mac一键启动
└── README.md
```

## 🎨 设计特点

- **分页式教学**: 类似PPT的章节导航，每页有可视化 + 文字解释 + 交互控件
- **实时计算**: 后端用NumPy执行真实的AI计算（前向传播、训练、卷积、注意力）
- **自研Canvas引擎**: 轻量的Shape/Scene/Tween/Timeline渲染框架，无需第三方依赖
- **深色主题**: 青紫色渐变配色，适合长时间学习

## 🗺️ Roadmap

下一步规划详见 [`docs/research/roadmap-2026-10.md`](docs/research/roadmap-2026-10.md)。摘要：

- **P0 · Agent 框架接入应用**：`/api/agent/chat` 端点（AgentError→HTTP 映射）+ 前端 API 封装
- **P1 · 前端 Agent Playground**：以第 10 章形式融入章节模型（零路由改动）；把 NumPy 计算服务注册为 Agent 工具形成教学闭环
- **P1 · 动画库收尾**：推理原理第三季剩余 9 集（inf-26–29、32–36）
- **P2 · 工程深化**：真实模型 e2e、评估集与 trace 落盘、子代理支持、会话持久化

## 📝 License

MIT
