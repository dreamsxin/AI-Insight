"""Saved-model persistence using JSON files.

Models are stored as individual JSON files under ``app/data/saved_models/``.
Each file contains the full weights/biases plus metadata (name, dataset,
epoch, loss, accuracy, timestamps). This is intentionally lightweight - no
database, no external dependencies - suited to an educational tool.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

MODELS_DIR = Path(__file__).parent.parent / "data" / "saved_models"


def _ensure_dir() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _timestamp() -> str:
    """ISO-8601 local timestamp string."""
    t = time.localtime()
    return time.strftime("%Y-%m-%dT%H:%M:%S", t)


def _gen_id() -> str:
    """Generate a unique model id from the current epoch time."""
    return f"m_{int(time.time() * 1000)}"


def _summary(model: dict) -> dict:
    """Extract the lightweight summary (no weights/biases)."""
    return {
        "id": model["id"],
        "name": model["name"],
        "dataset": model["dataset"],
        "layers": model["layers"],
        "epoch": model["epoch"],
        "loss": model["loss"],
        "accuracy": model.get("accuracy"),
        "created_at": model["created_at"],
        "updated_at": model["updated_at"],
    }


def list_saved_models() -> list[dict]:
    """List all saved models, most-recently-updated first."""
    _ensure_dir()
    models = []
    for f in MODELS_DIR.glob("*.json"):
        try:
            with open(f, encoding="utf-8") as fh:
                model = json.load(fh)
            models.append(_summary(model))
        except (json.JSONDecodeError, KeyError):
            continue
    models.sort(key=lambda m: m.get("updated_at", ""), reverse=True)
    return models


def save_model(
    name: str,
    dataset: str,
    layers: list[int],
    weights: list,
    biases: list,
    epoch: int,
    loss: float,
    accuracy=None,
    activation: str = "sigmoid",
    overwrite_id: str | None = None,
    optimizer_state=None,
) -> dict:
    """Save a model. If ``overwrite_id`` matches an existing model, update it
    in place (preserving ``created_at``); otherwise create a new entry."""
    _ensure_dir()
    now = _timestamp()

    if overwrite_id:
        existing_path = MODELS_DIR / f"{overwrite_id}.json"
        if existing_path.exists():
            with open(existing_path, encoding="utf-8") as fh:
                existing = json.load(fh)
            created_at = existing.get("created_at", now)
            model_id = overwrite_id
        else:
            created_at = now
            model_id = _gen_id()
    else:
        created_at = now
        model_id = _gen_id()

    model = {
        "id": model_id,
        "name": name,
        "dataset": dataset,
        "layers": layers,
        "activation": activation,
        "weights": weights,
        "biases": biases,
        "epoch": epoch,
        "loss": loss,
        "accuracy": accuracy,
        "optimizer_state": optimizer_state,
        "created_at": created_at,
        "updated_at": now,
    }

    path = MODELS_DIR / f"{model_id}.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(model, fh, ensure_ascii=False)

    return _summary(model)


def load_model(model_id: str) -> dict:
    """Load a full model (including weights/biases). Raises ValueError if not found."""
    _ensure_dir()
    path = MODELS_DIR / f"{model_id}.json"
    if not path.exists():
        raise ValueError(f"Model not found: {model_id}")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def delete_model(model_id: str) -> dict:
    """Delete a saved model. Raises ValueError if not found."""
    _ensure_dir()
    path = MODELS_DIR / f"{model_id}.json"
    if not path.exists():
        raise ValueError(f"Model not found: {model_id}")
    path.unlink()
    return {"id": model_id, "deleted": True}
