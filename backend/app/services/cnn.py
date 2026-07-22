"""CNN computation service: convolution and pooling with step recording."""

from __future__ import annotations

import numpy as np


# Predefined kernels for the feature-map visualization.
PREDEFINED_KERNELS: dict[str, list[list[float]]] = {
    "edge": [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
    "blur": [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
    "sharpen": [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
    "emboss": [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
}


def convolve(
    image: list[list[float]],
    kernel: list[list[float]],
    stride: int = 1,
    padding: int = 0,
):
    """Compute 2D convolution and record each sliding step.

    Returns output feature map and a list of step dicts for animation.
    """
    img = np.array(image, dtype=float)
    ker = np.array(kernel, dtype=float)

    kh, kw = ker.shape
    ih, iw = img.shape

    if padding > 0:
        img = np.pad(img, padding, mode="constant", constant_values=0)
        ih, iw = img.shape

    out_h = (ih - kh) // stride + 1
    out_w = (iw - kw) // stride + 1
    output = np.zeros((out_h, out_w))
    steps = []

    for r in range(out_h):
        for c in range(out_w):
            r_start = r * stride
            c_start = c * stride
            receptive = img[r_start : r_start + kh, c_start : c_start + kw]
            result = float(np.sum(receptive * ker))
            output[r, c] = result
            steps.append(
                {
                    "row": r,
                    "col": c,
                    "receptive_field": receptive.tolist(),
                    "result": result,
                }
            )

    return {
        "output": output.tolist(),
        "steps": steps,
    }


def pool(
    feature_map: list[list[float]],
    pool_size: int = 2,
    stride: int = 2,
    mode: str = "max",
):
    """Compute 2D pooling (max or avg) with step recording."""
    fm = np.array(feature_map, dtype=float)
    fh, fw = fm.shape

    out_h = (fh - pool_size) // stride + 1
    out_w = (fw - pool_size) // stride + 1
    output = np.zeros((out_h, out_w))
    steps = []

    for r in range(out_h):
        for c in range(out_w):
            r_start = r * stride
            c_start = c * stride
            region = fm[r_start : r_start + pool_size, c_start : c_start + pool_size]
            if mode == "max":
                val = float(np.max(region))
            else:
                val = float(np.mean(region))
            output[r, c] = val
            steps.append(
                {
                    "row": r,
                    "col": c,
                    "region": region.tolist(),
                    "result": val,
                }
            )

    return {
        "output": output.tolist(),
        "steps": steps,
    }
