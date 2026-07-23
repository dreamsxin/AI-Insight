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
        # Derivative is s*(1-s) where s = sigmoid(z), NOT clip(z,0,1)*(1-...).
        # The old clip-based version was mathematically wrong: it zeros the
        # gradient for all z>1, which kills the output layer's learning signal
        # and is the root cause of training getting stuck at ~75% accuracy.
        def _sigmoid(z):
            return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))
        return (
            _sigmoid,
            lambda z: (lambda s: s * (1 - s))(_sigmoid(z)),
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


def train_step(
    layers: list[int],
    data: list[list[float]],
    epochs: int = 1,
    learning_rate: float = 0.1,
    activation: str = "relu",
    weights=None,
    biases=None,
    seed: int = 42,
    return_predictions: bool = False,
    optimizer_state=None,
):
    """Run ``epochs`` of Adam-optimized gradient descent with warm-start.

    Unlike ``train()``, this accepts existing ``weights``/``biases`` so the
    caller can drive step-by-step training from the frontend.  Returns the
    current state (not just the final snapshot) plus optional per-sample
    predictions and classification accuracy for live visualization.

    ``optimizer_state`` carries Adam's first/second moment buffers and the
    timestep across calls, so momentum is *not* reset every HTTP request —
    this is essential because the frontend sends only a few epochs per call.
    """
    act_fn, act_deriv = _activation_fn(activation)
    # Output layer always uses sigmoid so predictions land in [0,1] for
    # binary / one-hot classification targets. Hidden layers use the
    # caller-specified activation. This split is standard practice and
    # avoids the output-saturation problem that a uniform sigmoid network
    # suffers from (gradients vanish when outputs are near 0 or 1).
    out_fn, out_deriv = _activation_fn("sigmoid")

    input_size = layers[0]
    output_size = layers[-1]
    samples = np.array(data, dtype=float)
    X = samples[:, :input_size].T  # [input_size, N]
    Y = samples[:, input_size:].T   # [output_size, N]
    N = X.shape[1]
    n_layers = len(layers) - 1  # number of weight matrices

    # Warm-start: reuse supplied params, or initialize fresh.
    # For sigmoid/tanh we use Xavier/Glorot init (not He, which is for ReLU)
    # to avoid early saturation that kills gradients.
    if weights is not None and biases is not None:
        weights = [np.array(w) for w in weights]
        biases = [np.array(b).reshape(-1, 1) for b in biases]
    else:
        rng = np.random.default_rng(seed)
        weights = []
        biases = []
        for i in range(n_layers):
            fan_in = layers[i]
            fan_out = layers[i + 1]
            if activation in ("sigmoid", "tanh"):
                # Xavier/Glorot uniform: range = sqrt(6 / (fan_in + fan_out))
                limit = np.sqrt(6.0 / (fan_in + fan_out))
                w = rng.uniform(-limit, limit, (fan_out, fan_in))
            else:
                # He initialization for ReLU-like activations
                scale = np.sqrt(2.0 / fan_in)
                w = rng.standard_normal((fan_out, fan_in)) * scale
            b = np.zeros((fan_out, 1))
            weights.append(w)
            biases.append(b)

    # Adam optimizer state — warm-start across calls so momentum is not
    # lost every HTTP request.  Plain GD / stateless momentum gets stuck at
    # saddle points (classic XOR plateau at loss≈0.27, acc 75%).  Adam's
    # per-parameter adaptive learning rate escapes these plateaus.
    beta1, beta2, eps = 0.9, 0.999, 1e-8
    if optimizer_state is not None and "m_w" in optimizer_state:
        m_w = [np.array(m) for m in optimizer_state["m_w"]]
        v_w = [np.array(v) for v in optimizer_state["v_w"]]
        m_b = [np.array(m).reshape(-1, 1) for m in optimizer_state["m_b"]]
        v_b = [np.array(v).reshape(-1, 1) for v in optimizer_state["v_b"]]
        t = optimizer_state.get("t", 0)
    else:
        m_w = [np.zeros_like(w) for w in weights]
        v_w = [np.zeros_like(w) for w in weights]
        m_b = [np.zeros_like(b) for b in biases]
        v_b = [np.zeros_like(b) for b in biases]
        t = 0

    loss_history = []
    predictions = None

    for _epoch in range(epochs):
        # --- Forward pass (store intermediates) ---
        # Hidden layers use act_fn; output layer uses sigmoid.
        activations = [X]  # a⁰ = X
        zs = []            # pre-activations

        a = X
        for i in range(n_layers):
            z = weights[i] @ a + biases[i]
            fn = out_fn if i == n_layers - 1 else act_fn
            a = fn(z)
            zs.append(z)
            activations.append(a)

        # --- Loss (MSE) ---
        pred = activations[-1]
        loss = np.mean((pred - Y) ** 2)
        loss_history.append(float(loss))

        # Capture predictions from the last epoch for visualization
        if return_predictions:
            predictions = pred.T.tolist()

        # --- Backward pass ---
        da = 2 * (pred - Y) / N  # MSE derivative

        grads_w = [None] * len(weights)
        grads_b = [None] * len(biases)

        for i in reversed(range(n_layers)):
            deriv = out_deriv if i == n_layers - 1 else act_deriv
            dz = da * deriv(zs[i])
            grads_w[i] = dz @ activations[i].T
            grads_b[i] = np.sum(dz, axis=1, keepdims=True)
            if i > 0:
                da = weights[i].T @ dz

        # --- Adam update ---
        t += 1
        bc1 = 1.0 - beta1 ** t   # bias correction
        bc2 = 1.0 - beta2 ** t
        for i in range(n_layers):
            m_w[i] = beta1 * m_w[i] + (1 - beta1) * grads_w[i]
            v_w[i] = beta2 * v_w[i] + (1 - beta2) * grads_w[i] ** 2
            weights[i] -= learning_rate * (m_w[i] / bc1) / (np.sqrt(v_w[i] / bc2) + eps)

            m_b[i] = beta1 * m_b[i] + (1 - beta1) * grads_b[i]
            v_b[i] = beta2 * v_b[i] + (1 - beta2) * grads_b[i] ** 2
            biases[i] -= learning_rate * (m_b[i] / bc1) / (np.sqrt(v_b[i] / bc2) + eps)

    # Classification accuracy (only meaningful for classification tasks)
    accuracy = None
    if return_predictions and predictions is not None and output_size >= 1:
        try:
            pred_labels = np.argmax(np.array(predictions), axis=1)
            if output_size == 1:
                # Binary: sigmoid output, threshold at 0.5
                true_labels = (Y.flatten() > 0.5).astype(int)
                pred_labels = (np.array(predictions).flatten() > 0.5).astype(int)
            else:
                true_labels = np.argmax(Y.T, axis=1)
            accuracy = float(np.mean(pred_labels == true_labels))
        except Exception:
            accuracy = None

    result = {
        "loss_history": loss_history,
        "weights": [w.tolist() for w in weights],
        "biases": [b.flatten().tolist() for b in biases],
        "optimizer_state": {
            "m_w": [m.tolist() for m in m_w],
            "v_w": [v.tolist() for v in v_w],
            "m_b": [m.flatten().tolist() for m in m_b],
            "v_b": [v.flatten().tolist() for v in v_b],
            "t": t,
        },
    }
    if return_predictions:
        result["predictions"] = predictions
        result["accuracy"] = accuracy
    return result
