"""Pydantic models for compute API requests and responses.

Bounds on numeric fields are intentionally generous compared to the UI
sliders (e.g. epochs slider tops out at 1000) but tight enough to stop a
hand-crafted request from allocating unbounded NumPy arrays or looping for
hours. Keep this in sync when adding new compute endpoints.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Neural Network
# ---------------------------------------------------------------------------

class NNForwardRequest(BaseModel):
    """Request body for ``POST /api/compute/nn/forward``."""

    layers: list[int] = Field(
        ..., min_length=2, max_length=8, description="Neuron counts per layer, e.g. [2, 3, 1]"
    )
    inputs: list[float] = Field(..., max_length=512, description="Input values matching layers[0]")
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
    """Response for ``POST /api/compute/nn/forward``."""

    layers: list[LayerResult]
    output: list[float]
    activation: str


class NNTrainRequest(BaseModel):
    """Request body for ``POST /api/compute/nn/train``."""

    layers: list[int] = Field(..., min_length=2, max_length=8)
    # Flattened samples: each inner list is [..inputs, ..targets]
    data: list[list[float]] = Field(..., max_length=20_000)
    epochs: int = Field(100, ge=1, le=20_000)
    learning_rate: float = Field(0.1, ge=0, le=10)
    activation: str = "relu"


class NNTrainResponse(BaseModel):
    """Response for ``POST /api/compute/nn/train`` - loss history and final weights."""

    loss_history: list[float]
    final_weights: list[list[list[float]]]
    final_biases: list[list[float]]


class NNTrainStepRequest(BaseModel):
    """Request body for ``POST /api/compute/nn/train/step`` - stepwise training."""

    layers: list[int] = Field(..., min_length=2, max_length=8)
    data: list[list[float]] = Field(..., max_length=20_000)  # [..inputs, ..targets]
    epochs: int = Field(1, ge=1, le=20_000)  # epochs to run this call
    learning_rate: float = Field(0.1, ge=0, le=10)
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
    """Request body for ``POST /api/compute/nn/models`` - save a trained model.

    ``overwrite_id`` is validated again in ``services/model_store.py`` (the
    service is the only writer and can also be called directly), so no regex
    is duplicated here.
    """

    name: str
    dataset: str
    layers: list[int] = Field(..., min_length=2, max_length=8)
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
    """Request body for ``POST /api/compute/cnn/convolve``."""

    image: list[list[float]] = Field(..., max_length=512)
    kernel: list[list[float]] = Field(..., max_length=64)
    stride: int = Field(1, ge=1, le=16)
    padding: int = Field(0, ge=0, le=16)


class ConvolveResponse(BaseModel):
    """Response with the feature map and step-by-step computations."""

    output: list[list[float]]
    steps: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Per-step computation for animation (row, col, receptive_field, result)",
    )


class PoolingRequest(BaseModel):
    """Request body for ``POST /api/compute/cnn/pool``."""

    feature_map: list[list[float]] = Field(..., max_length=512)
    pool_size: int = Field(2, ge=1, le=16)
    stride: int = Field(2, ge=1, le=16)
    mode: Literal["max", "avg"] = "max"


class PoolingResponse(BaseModel):
    output: list[list[float]]
    steps: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Transformer
# ---------------------------------------------------------------------------

class AttentionRequest(BaseModel):
    """Request body for ``POST /api/compute/transformer/attention``."""

    # Sequence of token vectors (already embedded), shape [seq_len, dim]
    sequence: list[list[float]] = Field(..., max_length=512)
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
    seq_len: int = Field(10, ge=1, le=512)
    dim: int = Field(16, ge=1, le=512)


class PositionalEncodingResponse(BaseModel):
    encoding: list[list[float]]
