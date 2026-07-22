# AI-Insight · AI原理可视化

> **洞见AI** — 看见神经网络的内部世界

一套基于 Python(FastAPI) + TypeScript(Vite) + 原生 Canvas API 的交互式 AI 原理可视化教程，用数据流动画和直观比喻让不懂数学公式的人也能理解 AI 原理。

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

## 🏗️ 技术架构

```
浏览器 (前端)                         Python 后端 (FastAPI)
┌──────────────────┐                 ┌──────────────────────┐
│ 章节导航 Sidebar  │   HTTP /api    │ 章节内容 API          │
│ Canvas 可视化引擎 │ ←───────────→  │ 计算引擎 (NumPy)     │
│ 交互控制面板      │                │ 100术语库            │
└──────────────────┘                 └──────────────────────┘
TypeScript + Vite                    Python + FastAPI + NumPy
```

### 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI | 异步、自动OpenAPI文档 |
| 后端计算 | NumPy | 神经网络/卷积/注意力计算 |
| 前端构建 | Vite | 极速HMR |
| 前端语言 | TypeScript (strict) | 类型安全 |
| 可视化 | 原生 Canvas 2D API | 自研轻量渲染引擎 |
| 后端测试 | pytest | 18个测试 |
| 前端测试 | Vitest | 25个测试 |

## 🚀 快速开始

### 环境要求

- Python 3.10+
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

## 📁 项目结构

```
ai-visualization/
├── backend/                  # Python FastAPI 后端
│   ├── main.py              # 入口
│   ├── app/
│   │   ├── models/          # Pydantic 数据模型
│   │   ├── data/            # 章节内容 + 100术语
│   │   ├── routers/         # API路由 (chapters/compute/terms)
│   │   ├── services/        # NumPy计算引擎 (NN/CNN/Transformer)
│   │   └── tests/           # pytest测试 (18个)
│   └── requirements.txt
├── frontend/                 # TypeScript Vite 前端
│   ├── src/
│   │   ├── canvas/           # 自研Canvas渲染引擎
│   │   │   ├── engine/       # Renderer, Scene, AnimationLoop
│   │   │   ├── shapes/       # Circle, Rect, Line, Text, Arrow...
│   │   │   └── animation/    # Tween, Easing, Timeline
│   │   ├── components/       # UI组件 (Sidebar, ControlsPanel...)
│   │   ├── core/             # App, Router, EventBus
│   │   ├── visualizations/   # 每章可视化实现
│   │   │   ├── ch01_functions/
│   │   │   ├── ...
│   │   │   └── ch09_terms/
│   │   └── utils/            # 数学/颜色工具
│   └── tests/                # Vitest测试 (25个)
├── start.bat                 # Windows一键启动
├── start.sh                  # Linux/Mac一键启动
└── README.md
```

## 🎨 设计特点

- **分页式教学**: 类似PPT的章节导航，每页有可视化 + 文字解释 + 交互控件
- **实时计算**: 后端用NumPy执行真实的AI计算（前向传播、训练、卷积、注意力）
- **自研Canvas引擎**: 轻量的Shape/Scene/Tween/Timeline渲染框架，无需第三方依赖
- **深色主题**: 青紫色渐变配色，适合长时间学习
## 📝 License

MIT
