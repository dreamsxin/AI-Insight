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
    """Response for ``POST /api/nn/train`` — loss history and final weights."""

    loss_history: list[float]
    final_weights: list[list[list[float]]]
    final_biases: list[list[float]]


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
