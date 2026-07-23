"""Pydantic models for compute API requests and responses."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Neural Network
# ---------------------------------------------------------------------------

class NNForwardRequest(BaseModel):
    """Request body for ``POST /api/nn/forward``."""

    layers: list[int] = Field(
        ..., description="Neuron counts per layer, e.g. [2, 3, 1]"
    )
    inputs: list[float] = Field(..., description="Input values matching layers[0]")
    # Optional explicit weights; if omitted random weights are used.
    weights: Optional[list[list[list[float]]]] = None
    biases: Optional[list[list[float]]] = None
    activation: str = Field("relu", description="Hidden-layer activation: relu|sigmoid|tanh")


class LayerResult(BaseModel):
    """Forward-pass result for a single layer."""

    index: int
    neurons: int
    # Pre-activation (z) and post-activation (a) values.
    z: list[float] = Field(default_factory=list)
    a: list[float] = Field(default_factory=list)
    weights: list[list[float]] = Field(default_factory=list)
    biases: list[float] = Field(default_factory=list)


class NNForwardResponse(BaseModel):
    """Response for ``POST /api/nn/forward``."""

    layers: list[LayerResult]
    output: list[float]
    activation: str


class NNTrainRequest(BaseModel):
    """Request body for ``POST /api/nn/train``."""

    layers: list[int]
    # Flattened samples: each inner list is [..inputs, ..targets]
    data: list[list[float]]
    epochs: int = 100
    learning_rate: float = 0.1
    activation: str = "relu"


class NNTrainResponse(BaseModel):
    """Response for ``POST /api/nn/train`` - loss history and final weights."""

    loss_history: list[float]
    final_weights: list[list[list[float]]]
    final_biases: list[list[float]]


class NNTrainStepRequest(BaseModel):
    """Request body for ``POST /api/nn/train/step`` - stepwise training."""

    layers: list[int]
    data: list[list[float]]  # [..inputs, ..targets]
    epochs: int = 1  # epochs to run this call
    learning_rate: float = 0.1
    activation: str = "relu"
    seed: int = 42
    weights: Optional[list[list[list[float]]]] = None  # warm start
    biases: Optional[list[list[float]]] = None
    return_predictions: bool = False
    # Adam optimizer state carried across calls so momentum is not lost.
    optimizer_state: Optional[dict[str, Any]] = None


class NNTrainStepResponse(BaseModel):
    """Response for stepwise training - current state + optional predictions."""

    loss_history: list[float]
    weights: list[list[list[float]]]
    biases: list[list[float]]
    predictions: Optional[list[list[float]]] = None
    accuracy: Optional[float] = None
    optimizer_state: dict[str, Any] = Field(
        default_factory=dict,
        description="Adam moment buffers + timestep; pass back on the next call",
    )


class DatasetInfo(BaseModel):
    """Lightweight dataset summary for listing."""

    name: str
    description: str
    sample_count: int
    input_dim: int
    output_dim: int
    n_classes: int
    suggested_layers: list[int]


class DatasetResponse(BaseModel):
    """Full dataset with samples and layout hints."""

    name: str
    description: str
    data: list[list[float]]
    points: list[list[float]]
    suggested_layers: list[int]
    input_dim: int
    output_dim: int
    n_classes: int


class SaveModelRequest(BaseModel):
    """Request body for ``POST /api/nn/models`` - save a trained model."""

    name: str
    dataset: str
    layers: list[int]
    activation: str = "sigmoid"
    weights: list[list[list[float]]]
    biases: list[list[float]]
    epoch: int = 0
    loss: float = 0.0
    accuracy: Optional[float] = None
    overwrite_id: Optional[str] = None
    # Persist Adam state so loaded models can resume training seamlessly.
    optimizer_state: Optional[dict[str, Any]] = None


class SavedModelSummary(BaseModel):
    """Lightweight model info for listing (no weights/biases)."""

    id: str
    name: str
    dataset: str
    layers: list[int]
    epoch: int
    loss: float
    accuracy: Optional[float] = None
    created_at: str
    updated_at: str


class SavedModelDetail(SavedModelSummary):
    """Full model including weights/biases for loading."""

    activation: str
    weights: list[list[list[float]]]
    biases: list[list[float]]
    optimizer_state: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# CNN
# ---------------------------------------------------------------------------

class ConvolveRequest(BaseModel):
    """Request body for ``POST /api/cnn/convolve``."""

    image: list[list[float]]
    kernel: list[list[float]]
    stride: int = 1
    padding: int = 0


class ConvolveResponse(BaseModel):
    """Response with the feature map and step-by-step computations."""

    output: list[list[float]]
    steps: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Per-step computation for animation (row, col, receptive_field, result)",
    )


class PoolingRequest(BaseModel):
    """Request body for ``POST /api/cnn/pool``."""

    feature_map: list[list[float]]
    pool_size: int = 2
    stride: int = 2
    mode: str = "max"  # "max" | "avg"


class PoolingResponse(BaseModel):
    output: list[list[float]]
    steps: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Transformer
# ---------------------------------------------------------------------------

class AttentionRequest(BaseModel):
    """Request body for ``POST /api/transformer/attention``."""

    # Sequence of token vectors (already embedded), shape [seq_len, dim]
    sequence: list[list[float]]
    # If True, apply causal mask (decoder-style).
    causal_mask: bool = False


class AttentionResponse(BaseModel):
    """Response with Q, K, V, scores, and attention weights."""

    q: list[list[float]]
    k: list[list[float]]
    v: list[list[float]]
    scores: list[list[float]]
    weights: list[list[float]]
    output: list[list[float]]


class PositionalEncodingRequest(BaseModel):
    seq_len: int = 10
    dim: int = 16


class PositionalEncodingResponse(BaseModel):
    encoding: list[list[float]]
