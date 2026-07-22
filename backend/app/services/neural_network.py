"""Neural network computation service using NumPy.

Implements forward pass, backpropagation training, and step recording
for the visualization frontend.
"""

from __future__ import annotations

import numpy as np


def _activation_fn(name: str):
    """Return (activate, activate_derivative) for a given name."""
    if name == "relu":
        return (
            lambda z: np.maximum(0, z),
            lambda z: (z > 0).astype(float),
        )
    if name == "sigmoid":
        return (
            lambda z: 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500))),
            lambda z: np.clip(z, 0, 1) * (1 - np.clip(z, 0, 1)),
        )
    if name == "tanh":
        return (
            lambda z: np.tanh(z),
            lambda z: 1 - np.tanh(z) ** 2,
        )
    if name == "step":
        return (
            lambda z: (z > 0).astype(float),
            lambda z: np.zeros_like(z),
        )
    raise ValueError(f"Unknown activation: {name}")


def init_params(layers: list[int], seed: int | None = 42):
    """Initialize weights and biases for a fully-connected network."""
    rng = np.random.default_rng(seed)
    weights = []
    biases = []
    for i in range(len(layers) - 1):
        # He initialization for ReLU-like activations
        scale = np.sqrt(2.0 / layers[i])
        w = rng.standard_normal((layers[i + 1], layers[i])) * scale
        b = np.zeros((layers[i + 1], 1))
        weights.append(w)
        biases.append(b)
    return weights, biases


def forward(
    layers: list[int],
    inputs: list[float],
    weights=None,
    biases=None,
    activation: str = "relu",
):
    """Run a forward pass and record per-layer results for visualization.

    Returns a dict with:
      - layers: list of per-layer {index, neurons, z, a, weights, biases}
      - output: final activation vector
      - activation: activation name used
    """
    act_fn, _ = _activation_fn(activation)

    if weights is None or biases is None:
        weights, biases = init_params(layers)
    else:
        weights = [np.array(w) for w in weights]
        biases = [np.array(b).reshape(-1, 1) for b in biases]

    a = np.array(inputs, dtype=float).reshape(-1, 1)
    layer_results = []

    for i in range(len(layers) - 1):
        z = weights[i] @ a + biases[i]
        a_next = act_fn(z)

        layer_results.append(
            {
                "index": i,
                "neurons": layers[i + 1],
                "z": z.flatten().tolist(),
                "a": a_next.flatten().tolist(),
                "weights": weights[i].tolist(),
                "biases": biases[i].flatten().tolist(),
            }
        )
        a = a_next

    return {
        "layers": layer_results,
        "output": a.flatten().tolist(),
        "activation": activation,
    }


def train(
    layers: list[int],
    data: list[list[float]],
    epochs: int = 100,
    learning_rate: float = 0.1,
    activation: str = "relu",
):
    """Train a network on the given dataset using gradient descent.

    Each sample in ``data`` is [..inputs, ..targets].
    Returns loss history and final weights/biases.
    """
    act_fn, act_deriv = _activation_fn(activation)

    input_size = layers[0]
    output_size = layers[-1]
    samples = np.array(data, dtype=float)
    X = samples[:, :input_size].T  # [input_size, N]
    Y = samples[:, input_size:].T   # [output_size, N]
    N = X.shape[1]

    weights, biases = init_params(layers)

    loss_history = []

    for epoch in range(epochs):
        # --- Forward pass (store intermediates) ---
        activations = [X]  # a⁰ = X
        zs = []            # pre-activations

        a = X
        for i in range(len(layers) - 1):
            z = weights[i] @ a + biases[i]
            a = act_fn(z)
            zs.append(z)
            activations.append(a)

        # --- Loss (MSE) ---
        pred = activations[-1]
        loss = np.mean((pred - Y) ** 2)
        loss_history.append(float(loss))

        # --- Backward pass ---
        # dL/da for output layer (MSE derivative)
        da = 2 * (pred - Y) / N

        grads_w = [None] * len(weights)
        grads_b = [None] * len(biases)

        for i in reversed(range(len(weights))):
            # dL/dz = dL/da * f'(z)
            dz = da * act_deriv(zs[i])
            # dL/dW = dz @ aᵢ⁻¹ᵀ
            grads_w[i] = dz @ activations[i].T
            # dL/db = sum(dz, axis=1)
            grads_b[i] = np.sum(dz, axis=1, keepdims=True)
            # propagate: dL/da_prev = Wᵀ @ dz
            if i > 0:
                da = weights[i].T @ dz

        # --- Update ---
        for i in range(len(weights)):
            weights[i] -= learning_rate * grads_w[i]
            biases[i] -= learning_rate * grads_b[i]

    return {
        "loss_history": loss_history,
        "final_weights": [w.tolist() for w in weights],
        "final_biases": [b.flatten().tolist() for b in biases],
    }
