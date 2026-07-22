"""Transformer computation service: attention and positional encoding."""

from __future__ import annotations

import numpy as np


def _softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    """Numerically stable softmax."""
    x_max = np.max(x, axis=axis, keepdims=True)
    e = np.exp(x - x_max)
    return e / np.sum(e, axis=axis, keepdims=True)


def attention(
    sequence: list[list[float]],
    causal_mask: bool = False,
):
    """Compute scaled dot-product self-attention.

    For simplicity Q = K = V = input sequence (no learned projections).
    This keeps the visualization focused on the attention mechanism itself.

    Returns Q, K, V, raw scores, attention weights, and output.
    """
    seq = np.array(sequence, dtype=float)  # [seq_len, dim]
    seq_len, dim = seq.shape

    # In a real Transformer these would be Q = seq @ W_Q, etc.
    # For the tutorial visualization we use the input directly so the
    # mechanics of attention are visible without random projections.
    Q = seq.copy()
    K = seq.copy()
    V = seq.copy()

    # Scaled dot-product: Q @ K^T / sqrt(d_k)
    scale = np.sqrt(dim)
    scores = (Q @ K.T) / scale  # [seq_len, seq_len]

    if causal_mask:
        mask = np.triu(np.ones((seq_len, seq_len), dtype=bool), k=1)
        scores = np.where(mask, -1e9, scores)

    weights = _softmax(scores, axis=-1)  # [seq_len, seq_len]
    output = weights @ V  # [seq_len, dim]

    return {
        "q": Q.tolist(),
        "k": K.tolist(),
        "v": V.tolist(),
        "scores": scores.tolist(),
        "weights": weights.tolist(),
        "output": output.tolist(),
    }


def positional_encoding(seq_len: int = 10, dim: int = 16) -> list[list[float]]:
    """Generate sinusoidal positional encoding (Vaswani et al.)."""
    pe = np.zeros((seq_len, dim))
    position = np.arange(seq_len)[:, np.newaxis]  # [seq_len, 1]
    # dim/2 frequency pairs
    div_term = np.exp(np.arange(0, dim, 2) * (-np.log(10000.0) / dim))
    pe[:, 0::2] = np.sin(position * div_term)
    if dim > 1:
        pe[:, 1::2] = np.cos(position * div_term[: pe[:, 1::2].shape[1]])
    return pe.tolist()
