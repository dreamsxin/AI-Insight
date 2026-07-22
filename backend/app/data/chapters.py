"""Structured chapter content data for the 9 chapters of the tutorial."""

from __future__ import annotations

from app.models.chapter import (
    Chapter,
    ContentBlock,
    ContentBlockType,
    ControlConfig,
    ControlType,
    Page,
)

# ---------------------------------------------------------------------------
# Chapter 1 – 从函数到神经网络
# ---------------------------------------------------------------------------

CH1 = Chapter(
    id=1,
    title="从函数到神经网络",
    subtitle="From Functions to Neural Networks",
    icon="📦",
    pages=[
        Page(
            id="p1",
            title="线性函数 y = wx + b",
            visualization="FunctionPlotViz",
            description="拖动滑块调节权重 w 和偏置 b，观察直线如何变化，理解线性变换的本质。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="一切 AI 的起点是一个简单的线性函数。给定输入 x，通过权重 w 和偏置 b，得到输出 y = wx + b。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="y = wx + b", meta={"latex": "y = wx + b"}),
                ContentBlock(type=ContentBlockType.NOTE, text='w 控制直线的斜率，b 控制直线的上下位置。这就是神经网络中一个"神经元"最基础的运算。'),
            ],
            controls=[
                ControlConfig(key="w", label="权重 w", type=ControlType.SLIDER, min=-3, max=3, step=0.1, default=1),
                ControlConfig(key="b", label="偏置 b", type=ControlType.SLIDER, min=-5, max=5, step=0.1, default=0),
            ],
        ),
        Page(
            id="p2",
            title="激活函数",
            visualization="ActivationViz",
            description="对比 Step、Sigmoid、ReLU、Tanh 四种激活函数的形状和特点。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="线性函数叠加仍是线性的。为了让神经网络拟合复杂的非线性关系，需要引入激活函数。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="a = f(wx + b)", meta={"latex": "a = f(wx + b)"}),
                ContentBlock(type=ContentBlockType.NOTE, text="• Step: 最早期的感知机使用，输出 0 或 1\n• Sigmoid: 将输出压缩到 (0,1)，曾广泛使用\n• ReLU: 简单高效 f(x)=max(0,x)，现代神经网络主流\n• Tanh: 输出在 (-1,1)，零中心化"),
            ],
            controls=[
                ControlConfig(key="activation", label="激活函数", type=ControlType.SELECT, options=["step", "sigmoid", "relu", "tanh"], default=2),
            ],
        ),
        Page(
            id="p3",
            title="从函数到神经元",
            visualization="NeuronBuildViz",
            description="观察如何从 y=f(wx+b) 逐步构建出一个完整的神经元模型。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="一个神经元 = 多输入加权求和 + 偏置 + 激活函数。这就是构成神经网络的最小单元。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="a = f(Σ(wᵢxᵢ) + b)", meta={"latex": "a = f\\left(\\sum_i w_i x_i + b\\right)"}),
                ContentBlock(type=ContentBlockType.NOTE, text="多个输入 x₁, x₂, ... 各自乘以权重 w₁, w₂, ... 求和后加上偏置 b，最后通过激活函数 f。"),
            ],
            controls=[
                ControlConfig(key="step", label="构建步骤", type=ControlType.SLIDER, min=0, max=3, step=1, default=0),
            ],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 2 – 计算神经网络的参数
# ---------------------------------------------------------------------------

CH2 = Chapter(
    id=2,
    title="计算神经网络的参数",
    subtitle="Calculating Neural Network Parameters",
    icon="🔗",
    pages=[
        Page(
            id="p1",
            title="神经网络的结构",
            visualization="NetworkGraphViz",
            description="调节隐藏层数量和每层神经元数，观察网络结构与参数规模如何变化。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="神经网络由多层神经元组成，层与层之间通过权重全连接。每个连线就是一个参数 w。"),
                ContentBlock(type=ContentBlockType.NOTE, text="增加隐藏层或神经元会提升网络表达能力，同时也会快速增加权重与偏置参数。"),
            ],
            controls=[
                ControlConfig(key="hidden_layers", label="隐藏层数量", type=ControlType.SLIDER, min=1, max=3, step=1, default=1, value_labels=["1 层", "2 层", "3 层"]),
                ControlConfig(key="hidden", label="隐藏层神经元数", type=ControlType.SLIDER, min=1, max=8, step=1, default=3),
            ],
        ),
        Page(
            id="p2",
            title="前向传播",
            visualization="ForwardPassViz",
            description="数据从左到右逐层流动，每个神经元依次计算加权求和与激活，最终得到输出。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="前向传播：输入数据依次通过每一层的计算，得到最终预测输出。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="a⁽ˡ⁾ = f(W⁽ˡ⁾ · a⁽ˡ⁻¹⁾ + b⁽ˡ⁾)"),
                ContentBlock(type=ContentBlockType.NOTE, text='先设置网络结构和激活函数，再点击“运行前向传播”。动画完成后可以重复运行。'),
            ],
            controls=[
                ControlConfig(key="hidden_layers", label="隐藏层数量", type=ControlType.SLIDER, min=1, max=3, step=1, default=1, value_labels=["1 层", "2 层", "3 层"]),
                ControlConfig(key="hidden", label="每层神经元数", type=ControlType.SLIDER, min=2, max=6, step=1, default=3),
                ControlConfig(key="activation", label="激活函数", type=ControlType.SELECT, options=["ReLU", "Sigmoid", "Tanh", "Step"], default=0),
                ControlConfig(key="run", label="运行前向传播", type=ControlType.BUTTON, default=0),
            ],
            api_endpoint="/api/nn/forward",
        ),
        Page(
            id="p3",
            title="矩阵乘法",
            visualization="MatrixMultViz",
            description="将前向传播表达为矩阵运算 W·x + b，理解为什么神经网络离不开矩阵乘法。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="把一层的所有权重排列成矩阵 W，一层的所有输入排列成向量 x，则该层计算为 a = f(W·x + b)。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="a = f(Wx + b)", meta={"latex": "\\mathbf{a} = f(W\\mathbf{x} + \\mathbf{b})"}),
                ContentBlock(type=ContentBlockType.NOTE, text="GPU 之所以擅长 AI 计算，正是因为矩阵乘法可以高度并行化。"),
            ],
            controls=[
                ControlConfig(key="step", label="计算步骤", type=ControlType.SLIDER, min=0, max=5, step=1, default=0),
            ],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 3 – 调教神经网络的方法
# ---------------------------------------------------------------------------

CH3 = Chapter(
    id=3,
    title="调教神经网络的方法",
    subtitle="Training Neural Networks",
    icon="🎯",
    pages=[
        Page(
            id="p1",
            title="损失函数",
            visualization="LossFunctionViz",
            description="损失函数衡量预测值与真实值的差距，是训练优化的目标。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="预测值与真实值之间的差距用损失函数衡量。差距越小，模型越好。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="MSE = (1/n) Σ(ŷᵢ - yᵢ)²", meta={"latex": "\\text{MSE} = \\frac{1}{n}\\sum_i (\\hat{y}_i - y_i)^2"}),
                ContentBlock(type=ContentBlockType.NOTE, text="常见的损失函数：回归用 MSE，分类用交叉熵 Cross-Entropy。"),
            ],
            controls=[
                ControlConfig(key="pred", label="预测值", type=ControlType.SLIDER, min=0, max=10, step=0.1, default=5),
                ControlConfig(key="target", label="真实值", type=ControlType.SLIDER, min=0, max=10, step=0.1, default=7),
            ],
        ),
        Page(
            id="p2",
            title="梯度下降",
            visualization="GradientDescentViz",
            description="小球沿梯度反方向滚向损失函数的最低点，学习率控制步长大小。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="梯度下降：沿损失函数下降最快的方向更新参数，就像小球滚向谷底。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="θ ← θ - η · ∇L", meta={"latex": "\\theta \\leftarrow \\theta - \\eta \\nabla L"}),
                ContentBlock(type=ContentBlockType.NOTE, text="学习率 η 太大可能跳过最低点，太小则收敛很慢。"),
            ],
            controls=[
                ControlConfig(key="lr", label="学习率", type=ControlType.SLIDER, min=0.01, max=1, step=0.01, default=0.1),
                ControlConfig(key="start_x", label="起始位置", type=ControlType.SLIDER, min=-3, max=3, step=0.1, default=2),
            ],
        ),
        Page(
            id="p3",
            title="反向传播",
            visualization="BackpropViz",
            description="误差从输出层反向传播，通过链式法则逐层计算梯度，更新权重。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="反向传播：从输出层开始，将损失误差反向传递，利用链式法则计算每一层参数的梯度。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="∂L/∂w = ∂L/∂a · ∂a/∂z · ∂z/∂w", meta={"latex": "\\frac{\\partial L}{\\partial w} = \\frac{\\partial L}{\\partial a} \\cdot \\frac{\\partial a}{\\partial z} \\cdot \\frac{\\partial z}{\\partial w}"}),
                ContentBlock(type=ContentBlockType.NOTE, text='前向传播计算输出 -> 计算损失 -> 反向传播计算梯度 -> 更新参数。这四个步骤循环就是"训练"。'),
            ],
            controls=[
                ControlConfig(key="run", label="运行训练", type=ControlType.BUTTON, default=0),
            ],
            api_endpoint="/api/nn/train",
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 4 – 从矩阵到CNN
# ---------------------------------------------------------------------------

CH4 = Chapter(
    id=4,
    title="从矩阵到CNN",
    subtitle="From Matrices to CNN",
    icon="🖼️",
    pages=[
        Page(
            id="p1",
            title="图像即矩阵",
            visualization="ImageMatrixViz",
            description="一张图片就是一个数字矩阵，每个像素是一个0-255的数值。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="对计算机来说，一张灰度图就是一个二维数值矩阵。彩色图则是三个矩阵（R、G、B）。"),
                ContentBlock(type=ContentBlockType.NOTE, text="鼠标悬停在像素上可以看到对应的数值。数值越大越亮，越小越暗。"),
            ],
            controls=[
                ControlConfig(key="image", label="图片", type=ControlType.SELECT, options=["digit", "circle", "cross"], default=0),
            ],
        ),
        Page(
            id="p2",
            title="卷积操作",
            visualization="ConvolutionViz",
            description="卷积核在图像上滑动，每一步计算加权求和，得到特征图。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="卷积：一个小矩阵（卷积核）在图像上滑动，每次覆盖一个区域做加权求和。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="output[i,j] = Σ kernel[m,n] · image[i+m, j+n]"),
                ContentBlock(type=ContentBlockType.NOTE, text='点击"运行卷积"按钮，观察卷积核滑动并逐步生成特征图的过程。'),
            ],
            controls=[
                ControlConfig(key="run", label="运行卷积", type=ControlType.BUTTON, default=0),
                ControlConfig(key="stride", label="步长", type=ControlType.SLIDER, min=1, max=3, step=1, default=1),
            ],
            api_endpoint="/api/cnn/convolve",
        ),
        Page(
            id="p3",
            title="特征图与卷积核",
            visualization="FeatureMapViz",
            description="不同的卷积核检测不同的特征：边缘、模糊、锐化。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="不同卷积核提取不同特征。边缘检测核找出轮廓，模糊核做平滑，锐化核增强细节。"),
                ContentBlock(type=ContentBlockType.NOTE, text="在CNN中，卷积核的值是网络通过训练学到的，不需要人工设计。"),
            ],
            controls=[
                ControlConfig(key="kernel", label="卷积核", type=ControlType.SELECT, options=["edge", "blur", "sharpen", "emboss"], default=0),
            ],
        ),
        Page(
            id="p4",
            title="池化",
            visualization="PoolingViz",
            description="池化操作缩小特征图尺寸，保留主要信息，减少计算量。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="池化：将特征图划分成小块，每块取最大值（最大池化）或平均值（平均池化）。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="out[i,j] = max(region[i:i+p, j:j+p])"),
                ContentBlock(type=ContentBlockType.NOTE, text="池化的作用：降维、减少参数、提供一定的平移不变性。"),
            ],
            controls=[
                ControlConfig(key="pool_size", label="池化窗口", type=ControlType.SLIDER, min=2, max=4, step=1, default=2),
                ControlConfig(key="mode", label="池化方式", type=ControlType.SELECT, options=["max", "avg"], default=0),
            ],
            api_endpoint="/api/cnn/pool",
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 5 – 从RNN到Transformer
# ---------------------------------------------------------------------------

CH5 = Chapter(
    id=5,
    title="从RNN到Transformer",
    subtitle="From RNN to Transformer",
    icon="🔄",
    pages=[
        Page(
            id="p1",
            title="RNN 序列处理",
            visualization="RNNSequenceViz",
            description="RNN 按时间步展开，每一步的隐藏状态传递给下一步，实现序列记忆。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="RNN（循环神经网络）处理序列数据，每一步接收一个输入，并将隐藏状态传递给下一步。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="hₜ = f(W·xₜ + U·hₜ₋₁ + b)", meta={"latex": "h_t = f(W x_t + U h_{t-1} + b)"}),
                ContentBlock(type=ContentBlockType.NOTE, text='RNN 的核心思想：用隐藏状态 hₜ 来"记忆"之前的信息。'),
            ],
            controls=[
                ControlConfig(key="seq_len", label="序列长度", type=ControlType.SLIDER, min=3, max=8, step=1, default=5),
                ControlConfig(key="step", label="时间步", type=ControlType.SLIDER, min=0, max=7, step=1, default=0),
            ],
        ),
        Page(
            id="p2",
            title="长距离依赖问题",
            visualization="LongDependencyViz",
            description="RNN 在处理长序列时，早期信息会逐渐丢失，难以捕捉长距离依赖。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="RNN 的致命弱点：随着序列变长，早期信息在反复传递中逐渐衰减，导致长距离依赖丢失。"),
                ContentBlock(type=ContentBlockType.NOTE, text="这就是梯度消失/梯度爆炸问题。LSTM 和 GRU 部分缓解了这个问题，但没有从根本上解决。"),
            ],
            controls=[
                ControlConfig(key="seq_len", label="序列长度", type=ControlType.SLIDER, min=4, max=12, step=1, default=8),
            ],
        ),
        Page(
            id="p3",
            title="注意力的引入",
            visualization="AttentionConceptViz",
            description="Transformer 的核心思想：每个词都可以直接关注序列中的任意其他词。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="注意力机制打破了 RNN 的顺序处理限制：每个位置可以同时关注所有位置，信息无需逐步传递。"),
                ContentBlock(type=ContentBlockType.NOTE, text="这就是 Transformer 的核心创新：用注意力机制替代循环，实现了全局信息交互和并行计算。"),
            ],
            controls=[
                ControlConfig(key="focus", label="关注词", type=ControlType.SLIDER, min=0, max=5, step=1, default=0),
            ],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 6 – Transformer 简单而强大
# ---------------------------------------------------------------------------

CH6 = Chapter(
    id=6,
    title="Transformer 简单而强大",
    subtitle="Transformer: Simple and Powerful",
    icon="⚡",
    pages=[
        Page(
            id="p1",
            title="Self-Attention (Q/K/V)",
            visualization="SelfAttentionViz",
            description="每个词生成 Query、Key、Value 三个向量，通过点积计算词与词之间的关联度。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="Self-Attention 的三步：① 每个词生成 Q(查询)、K(键)、V(值) ② Q·K 计算注意力分数 ③ 用分数对 V 加权求和。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="Attention(Q,K,V) = softmax(QKᵀ/√dₖ)·V", meta={"latex": "\\text{Attention}(Q,K,V) = \\text{softmax}\\!\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right) V"}),
                ContentBlock(type=ContentBlockType.NOTE, text="Q 像搜索引擎的查询词，K 像页面标题，V 像页面内容。Q·K 算相关度，加权取内容。"),
            ],
            controls=[
                ControlConfig(key="focus", label="查询位置", type=ControlType.SLIDER, min=0, max=5, step=1, default=0),
            ],
            api_endpoint="/api/transformer/attention",
        ),
        Page(
            id="p2",
            title="缩放点积注意力",
            visualization="ScaledDotProductViz",
            description="点积分数除以 √dₖ 后做 Softmax，理解为什么需要缩放。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="Q·K 的点积值随着维度增大而变大，导致 softmax 梯度趋近 0。除以 √dₖ 进行缩放。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="scores = QKᵀ / √dₖ"),
                ContentBlock(type=ContentBlockType.NOTE, text="SoftMax 将分数归一化为概率分布，所有权重之和为 1。"),
            ],
            controls=[
                ControlConfig(key="step", label="计算步骤", type=ControlType.SLIDER, min=0, max=3, step=1, default=0),
            ],
        ),
        Page(
            id="p3",
            title="多头注意力",
            visualization="MultiHeadViz",
            description="多个注意力头并行工作，各自关注不同的语义关系。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="多头注意力：把 Q/K/V 分成多组，每组独立做注意力，最后拼接。不同头可以关注不同模式。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="headᵢ = Attention(QWᵢQ, KWᵢK, VWᵢV)"),
                ContentBlock(type=ContentBlockType.NOTE, text="例如一个头关注语法关系，另一个关注语义相似度，第三个关注位置邻近性。"),
            ],
            controls=[
                ControlConfig(key="heads", label="注意力头数", type=ControlType.SLIDER, min=1, max=8, step=1, default=4),
            ],
        ),
        Page(
            id="p4",
            title="位置编码",
            visualization="PositionalEncodingViz",
            description="用正弦/余弦函数为每个位置生成独特的编码向量，补充位置信息。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="Self-Attention 本身没有顺序概念。位置编码用正弦/余弦函数为每个位置注入位置信息。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="PE(pos, 2i) = sin(pos/10000^(2i/d))", meta={"latex": "PE_{(pos,2i)} = \\sin(pos / 10000^{2i/d_{model}})"}),
                ContentBlock(type=ContentBlockType.NOTE, text="不同维度使用不同频率的正弦波，使每个位置的编码唯一且能泛化到更长序列。"),
            ],
            controls=[
                ControlConfig(key="dim", label="编码维度", type=ControlType.SLIDER, min=8, max=64, step=8, default=16),
                ControlConfig(key="pos", label="查看位置", type=ControlType.SLIDER, min=0, max=20, step=1, default=0),
            ],
            api_endpoint="/api/transformer/positional_encoding",
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 7 – 鸟瞰 Transformer
# ---------------------------------------------------------------------------

CH7 = Chapter(
    id=7,
    title="鸟瞰 Transformer",
    subtitle="Bird's-Eye View of Transformer",
    icon="🏗️",
    pages=[
        Page(
            id="p1",
            title="完整架构图",
            visualization="ArchitectureViz",
            description="Transformer 的完整架构：Encoder + Decoder，点击各组件查看详情。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="Transformer 由 Encoder 和 Decoder 两部分组成。原始论文中 Encoder 有 6 层，Decoder 也有 6 层。"),
                ContentBlock(type=ContentBlockType.NOTE, text="点击架构图中的任意组件，查看其功能说明。\n• Input Embedding + Positional Encoding\n• Multi-Head Attention\n• Feed Forward Network\n• Residual Connection + Layer Norm"),
            ],
            controls=[
                ControlConfig(key="focus", label="焦点组件", type=ControlType.SLIDER, min=0, max=8, step=1, default=0),
            ],
        ),
        Page(
            id="p2",
            title="Encoder 拆解",
            visualization="EncoderDetailViz",
            description="Encoder 的核心：多头自注意力 + 前馈网络 + 残差连接 + 层归一化。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="每一层 Encoder 包含两个子层：① 多头自注意力 ② 前馈网络(FFN)。每个子层都有残差连接和 LayerNorm。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="FFN(x) = max(0, xW₁+b₁)W₂+b₂"),
                ContentBlock(type=ContentBlockType.NOTE, text="残差连接帮助梯度流动，LayerNorm 稳定训练。"),
            ],
            controls=[
                ControlConfig(key="step", label="展示步骤", type=ControlType.SLIDER, min=0, max=4, step=1, default=0),
            ],
        ),
        Page(
            id="p3",
            title="数据流",
            visualization="DataFlowViz",
            description="一个 token 从输入到输出的完整路径动画。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="追踪一个 token 在 Transformer 中的完整旅程：分词 → Embedding → 位置编码 → Attention → FFN → 输出。"),
                ContentBlock(type=ContentBlockType.NOTE, text='点击"播放"按钮，观看 token 逐步通过各个模块的动画过程。'),
            ],
            controls=[
                ControlConfig(key="run", label="播放动画", type=ControlType.BUTTON, default=0),
            ],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 8 – 文字的向量化
# ---------------------------------------------------------------------------

CH8 = Chapter(
    id=8,
    title="文字的向量化",
    subtitle="Text Vectorization",
    icon="🔤",
    pages=[
        Page(
            id="p1",
            title="分词 (Tokenization)",
            visualization="TokenizerViz",
            description="将文本切分为 token 序列，BPE 是大模型最常用的分词方法。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text='计算机无法直接理解文字，需要先分词。将"我爱AI"切分为 ["我", "爱", "AI"] 等基本单元。'),
                ContentBlock(type=ContentBlockType.NOTE, text="BPE(Byte Pair Encoding) 通过统计高频字符对来合并，在子词粒度和词汇量之间取得平衡。GPT/Claude 等模型都使用 BPE 变体。"),
            ],
            controls=[
                ControlConfig(key="text", label="输入文本", type=ControlType.SELECT, options=["我爱人工智能", "Transformer is powerful", "今天天气真好"], default=0),
            ],
        ),
        Page(
            id="p2",
            title="Token → ID → Embedding",
            visualization="EmbeddingPipelineViz",
            description="三步变换流水线：token 查词表得到 ID，ID 查嵌入矩阵得到稠密向量。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="分词后，每个 token 通过词表映射为整数 ID，再通过嵌入矩阵(Embedding Matrix)变为稠密向量。"),
                ContentBlock(type=ContentBlockType.FORMULA, text="embedding = E[token_id]"),
                ContentBlock(type=ContentBlockType.NOTE, text="嵌入矩阵是模型训练学到的，编码了词的语义信息。相似词的向量距离更近。"),
            ],
            controls=[
                ControlConfig(key="step", label="流水线步骤", type=ControlType.SLIDER, min=0, max=3, step=1, default=0),
            ],
        ),
        Page(
            id="p3",
            title="向量空间",
            visualization="EmbeddingSpaceViz",
            description="将高维词向量降维到2D平面，观察语义相近的词如何聚集在一起。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="词向量分布在几百维空间中。降维到2D后，可以看到语义相近的词聚集在一起。"),
                ContentBlock(type=ContentBlockType.NOTE, text="经典的例子：king - man + woman ≈ queen。向量运算可以类比语义关系。"),
            ],
            controls=[
                ControlConfig(key="category", label="词类别", type=ControlType.SELECT, options=["动物", "颜色", "国家", "混合"], default=3),
            ],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Chapter 9 – 速通大模型100词
# ---------------------------------------------------------------------------

CH9 = Chapter(
    id=9,
    title="速通大模型100词",
    subtitle="100 Large-Model Terms",
    icon="📚",
    pages=[
        Page(
            id="p1",
            title="术语网格",
            visualization="TermGridViz",
            description="100个大模型核心术语，按分类着色，支持搜索和筛选。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="大模型领域的100个核心术语，覆盖基础概念、架构、训练、推理、应用等分类。"),
                ContentBlock(type=ContentBlockType.NOTE, text="点击任意术语卡片查看详细解释。使用搜索框快速查找特定术语。"),
            ],
            controls=[
                ControlConfig(key="filter", label="分类筛选", type=ControlType.SELECT, options=["全部", "基础概念", "模型架构", "训练技术", "推理部署", "应用生态"], default=0),
            ],
        ),
        Page(
            id="p2",
            title="术语详情",
            visualization="TermDetailViz",
            description="点击术语卡片，查看中英文、解释和关联术语。",
            content=[
                ContentBlock(type=ContentBlockType.TEXT, text="每个术语包含：中文名、英文名、分类标签、一句话解释和详细说明。"),
                ContentBlock(type=ContentBlockType.NOTE, text="关联术语展示该术语与其他概念的关系网络。"),
            ],
            controls=[
                ControlConfig(key="term_id", label="术语ID", type=ControlType.SLIDER, min=0, max=99, step=1, default=0),
            ],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Aggregate
# ---------------------------------------------------------------------------

ALL_CHAPTERS: list[Chapter] = [CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8, CH9]

CHAPTERS_BY_ID: dict[int, Chapter] = {ch.id: ch for ch in ALL_CHAPTERS}


def get_chapter_summaries():
    """Return lightweight summaries for sidebar listing."""
    return [
        {
            "id": ch.id,
            "title": ch.title,
            "subtitle": ch.subtitle,
            "page_count": len(ch.pages),
            "icon": ch.icon,
        }
        for ch in ALL_CHAPTERS
    ]


def get_chapter(chapter_id: int):
    """Return a chapter by id, or None."""
    return CHAPTERS_BY_ID.get(chapter_id)
