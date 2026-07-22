"""Compute API routes – neural network, CNN, and Transformer."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.compute import (
    AttentionRequest,
    ConvolveRequest,
    NNForwardRequest,
    NNTrainRequest,
    PoolingRequest,
    PositionalEncodingRequest,
)
from app.services.cnn import convolve as cnn_convolve
from app.services.cnn import pool as cnn_pool
from app.services.neural_network import forward as nn_forward
from app.services.neural_network import train as nn_train
from app.services.transformer import attention as tf_attention
from app.services.transformer import positional_encoding as tf_pe

router = APIRouter(prefix="/compute", tags=["compute"])


def _safe(call, *args, **kwargs):
    """Run a compute function, translating ValueError to HTTP 400."""
    try:
        return call(*args, **kwargs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ---------------------------------------------------------------------------
# Neural Network
# ---------------------------------------------------------------------------

@router.post("/nn/forward")
async def nn_forward_endpoint(req: NNForwardRequest):
    """Run a forward pass through a fully-connected network."""
    return _safe(
        nn_forward,
        layers=req.layers,
        inputs=req.inputs,
        weights=req.weights,
        biases=req.biases,
        activation=req.activation,
    )


@router.post("/nn/train")
async def nn_train_endpoint(req: NNTrainRequest):
    """Train a network and return loss history + final weights."""
    return _safe(
        nn_train,
        layers=req.layers,
        data=req.data,
        epochs=req.epochs,
        learning_rate=req.learning_rate,
        activation=req.activation,
    )


# ---------------------------------------------------------------------------
# CNN
# ---------------------------------------------------------------------------

@router.post("/cnn/convolve")
async def cnn_convolve_endpoint(req: ConvolveRequest):
    """Run 2D convolution and return feature map + steps."""
    return _safe(cnn_convolve, req.image, req.kernel, req.stride, req.padding)


@router.post("/cnn/pool")
async def cnn_pool_endpoint(req: PoolingRequest):
    """Run 2D pooling and return result + steps."""
    return _safe(cnn_pool, req.feature_map, req.pool_size, req.stride, req.mode)


# ---------------------------------------------------------------------------
# Transformer
# ---------------------------------------------------------------------------

@router.post("/transformer/attention")
async def transformer_attention_endpoint(req: AttentionRequest):
    """Compute self-attention for a sequence of vectors."""
    return _safe(tf_attention, req.sequence, req.causal_mask)


@router.post("/transformer/positional_encoding")
async def transformer_pe_endpoint(req: PositionalEncodingRequest):
    """Generate sinusoidal positional encoding."""
    return _safe(lambda: {"encoding": tf_pe(req.seq_len, req.dim)})
