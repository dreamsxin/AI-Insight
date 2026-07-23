"""Tests for the neural network compute endpoints."""

from fastapi.testclient import TestClient


def test_nn_forward_basic(client: TestClient):
    resp = client.post(
        "/api/compute/nn/forward",
        json={
            "layers": [2, 3, 1],
            "inputs": [1.0, 2.0],
            "activation": "relu",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "layers" in data
    assert len(data["layers"]) == 2  # two weight layers
    assert "output" in data
    assert len(data["output"]) == 1
    # Each layer result should have z, a, weights, biases
    layer0 = data["layers"][0]
    assert layer0["neurons"] == 3
    assert len(layer0["z"]) == 3
    assert len(layer0["a"]) == 3
    assert len(layer0["weights"]) == 3  # 3 rows
    assert len(layer0["weights"][0]) == 2  # 2 cols


def test_nn_forward_sigmoid(client: TestClient):
    resp = client.post(
        "/api/compute/nn/forward",
        json={
            "layers": [2, 2, 1],
            "inputs": [0.5, -0.5],
            "activation": "sigmoid",
        },
    )
    assert resp.status_code == 200
    out = resp.json()["output"][0]
    # Sigmoid output is always between 0 and 1
    assert 0 <= out <= 1


def test_nn_train(client: TestClient):
    resp = client.post(
        "/api/compute/nn/train",
        json={
            "layers": [1, 8, 1],
            "data": [[0.0, 0.0], [1.0, 2.0], [2.0, 4.0], [3.0, 6.0]],
            "epochs": 200,
            "learning_rate": 0.05,
            "activation": "sigmoid",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "loss_history" in data
    assert len(data["loss_history"]) == 200
    # Loss should generally decrease (allowing for minor fluctuations)
    initial = data["loss_history"][0]
    final = data["loss_history"][-1]
    assert final < initial, f"Loss did not decrease: {initial} -> {final}"
    assert len(data["final_weights"]) == 2
    assert len(data["final_biases"]) == 2


def test_nn_forward_invalid_activation(client: TestClient):
    resp = client.post(
        "/api/compute/nn/forward",
        json={"layers": [2, 1], "inputs": [1.0, 2.0], "activation": "bogus"},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Stepwise training (train_step)
# ---------------------------------------------------------------------------

def test_nn_train_step_warm_start(client: TestClient):
    """Second step should continue from first step's weights (loss keeps dropping)."""
    # First step: fresh init, 50 epochs
    resp1 = client.post(
        "/api/compute/nn/train/step",
        json={
            "layers": [2, 8, 1],
            "data": [[0.0, 0.0, 0.0], [0.0, 1.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 0.0]],
            "epochs": 50,
            "learning_rate": 0.5,
            "activation": "sigmoid",
            "return_predictions": True,
        },
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert len(data1["loss_history"]) == 50
    assert "weights" in data1 and "biases" in data1
    loss_after_50 = data1["loss_history"][-1]

    # Second step: warm-start from first step's weights, 50 more epochs
    resp2 = client.post(
        "/api/compute/nn/train/step",
        json={
            "layers": [2, 8, 1],
            "data": [[0.0, 0.0, 0.0], [0.0, 1.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 0.0]],
            "epochs": 50,
            "learning_rate": 0.5,
            "activation": "sigmoid",
            "weights": data1["weights"],
            "biases": data1["biases"],
            "return_predictions": True,
        },
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    loss_after_100 = data2["loss_history"][-1]
    # Warm-started training should continue to improve
    assert loss_after_100 <= loss_after_50 + 0.01  # allow tiny fluctuation


def test_nn_train_step_predictions(client: TestClient):
    """return_predictions should produce per-sample output + accuracy."""
    resp = client.post(
        "/api/compute/nn/train/step",
        json={
            "layers": [2, 4, 1],
            "data": [[0.0, 0.0, 0.0], [1.0, 1.0, 0.0]],
            "epochs": 10,
            "learning_rate": 0.1,
            "activation": "sigmoid",
            "return_predictions": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "predictions" in data and data["predictions"] is not None
    assert len(data["predictions"]) == 2  # 2 samples
    assert len(data["predictions"][0]) == 1  # 1 output
    assert data["accuracy"] is not None
    assert 0.0 <= data["accuracy"] <= 1.0


def test_nn_train_step_optimizer_state_warm_start(client: TestClient):
    """Passing optimizer_state back should yield lower loss than resetting it."""
    xor_data = [
        [-1.0, -1.0, 0.0],
        [-1.0, 1.0, 1.0],
        [1.0, -1.0, 1.0],
        [1.0, 1.0, 0.0],
    ]
    req_base = {
        "layers": [2, 4, 1],
        "data": xor_data,
        "epochs": 20,
        "learning_rate": 0.01,
        "activation": "tanh",
        "return_predictions": True,
    }

    # --- Path A: carry optimizer_state across calls (warm-start) ---
    resp = client.post("/api/compute/nn/train/step", json=req_base)
    data1 = resp.json()
    assert "optimizer_state" in data1
    opt = data1["optimizer_state"]
    assert "m_w" in opt and "v_w" in opt and "t" in opt
    assert opt["t"] == 20

    resp2 = client.post(
        "/api/compute/nn/train/step",
        json={**req_base, "weights": data1["weights"], "biases": data1["biases"],
              "optimizer_state": opt},
    )
    loss_with_state = resp2.json()["loss_history"][-1]

    # --- Path B: same weights/biases but NO optimizer_state (reset Adam) ---
    resp3 = client.post(
        "/api/compute/nn/train/step",
        json={**req_base, "weights": data1["weights"], "biases": data1["biases"]},
    )
    loss_without_state = resp3.json()["loss_history"][-1]

    # Warm-started optimizer should converge better (momentum not lost)
    assert loss_with_state < loss_without_state


def test_nn_train_step_converges_xor(client: TestClient):
    """XOR should reach high accuracy with step-by-step Adam training."""
    xor_data = [
        [-1.0, -1.0, 0.0],
        [-1.0, 1.0, 1.0],
        [1.0, -1.0, 1.0],
        [1.0, 1.0, 0.0],
    ]
    weights = biases = opt = None
    for _ in range(30):  # 30 calls x 10 epochs = 300 total
        body = {
            "layers": [2, 4, 1],
            "data": xor_data,
            "epochs": 10,
            "learning_rate": 0.01,
            "activation": "tanh",
            "return_predictions": True,
        }
        if weights is not None:
            body["weights"] = weights
            body["biases"] = biases
            body["optimizer_state"] = opt
        resp = client.post("/api/compute/nn/train/step", json=body)
        data = resp.json()
        weights = data["weights"]
        biases = data["biases"]
        opt = data["optimizer_state"]
    # After 300 epochs XOR should be well above chance (was stuck at 75% before fix)
    assert data["accuracy"] >= 0.95, f"XOR accuracy too low: {data['accuracy']}"


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------

def test_nn_datasets_listing(client: TestClient):
    resp = client.get("/api/compute/nn/datasets")
    assert resp.status_code == 200
    datasets = resp.json()["datasets"]
    names = [d["name"] for d in datasets]
    assert "xor" in names and "moons" in names and "digits" in names
    for d in datasets:
        assert "sample_count" in d and "suggested_layers" in d and "input_dim" in d


def test_nn_dataset_xor(client: TestClient):
    resp = client.get("/api/compute/nn/datasets/xor")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "xor"
    assert len(data["data"]) == 4  # XOR has 4 samples
    assert data["suggested_layers"] == [2, 4, 1]
    assert data["input_dim"] == 2 and data["n_classes"] == 2


def test_nn_dataset_digits(client: TestClient):
    resp = client.get("/api/compute/nn/datasets/digits")
    assert resp.status_code == 200
    data = resp.json()
    assert data["input_dim"] == 64
    assert data["output_dim"] == 10
    assert data["n_classes"] == 10
    assert data["suggested_layers"] == [64, 32, 10]
    # Each sample: 64 pixels + 10 one-hot targets = 74
    assert len(data["data"][0]) == 74


def test_nn_dataset_unknown(client: TestClient):
    resp = client.get("/api/compute/nn/datasets/nonexistent")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Saved models (save / load / list / delete)
# ---------------------------------------------------------------------------

def test_save_load_model(client: TestClient):
    """Save -> list -> load -> delete round-trip."""
    # Save a model
    save_resp = client.post(
        "/api/compute/nn/models",
        json={
            "name": "test-moons-model",
            "dataset": "moons",
            "layers": [2, 8, 1],
            "activation": "sigmoid",
            "weights": [[[0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8],
                         [0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]],
                        [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]]],
            "biases": [[0.0] * 8, [0.0]],
            "epoch": 100,
            "loss": 0.05,
            "accuracy": 0.95,
            "optimizer_state": {
                "m_w": [[[0.0, 0.0]] * 8, [[0.0] * 8]],
                "v_w": [[[0.0, 0.0]] * 8, [[0.0] * 8]],
                "m_b": [[0.0] * 8, [0.0]],
                "v_b": [[0.0] * 8, [0.0]],
                "t": 100,
            },
        },
    )
    assert save_resp.status_code == 200
    saved = save_resp.json()
    model_id = saved["id"]
    assert saved["name"] == "test-moons-model"

    # List should contain it
    list_resp = client.get("/api/compute/nn/models")
    assert list_resp.status_code == 200
    ids = [m["id"] for m in list_resp.json()["models"]]
    assert model_id in ids

    # Load should return full weights/biases + optimizer_state
    load_resp = client.get(f"/api/compute/nn/models/{model_id}")
    assert load_resp.status_code == 200
    loaded = load_resp.json()
    assert loaded["id"] == model_id
    assert "weights" in loaded and "biases" in loaded
    assert len(loaded["weights"]) == 2  # 2 weight layers
    assert loaded["accuracy"] == 0.95
    # optimizer_state should be persisted
    assert loaded.get("optimizer_state") is not None
    assert loaded["optimizer_state"]["t"] == 100

    # Delete
    del_resp = client.delete(f"/api/compute/nn/models/{model_id}")
    assert del_resp.status_code == 200

    # List should no longer contain it
    list_resp2 = client.get("/api/compute/nn/models")
    ids2 = [m["id"] for m in list_resp2.json()["models"]]
    assert model_id not in ids2


def test_save_model_overwrite(client: TestClient):
    """Saving with overwrite_id updates the existing model instead of creating a new one."""
    # Save initial
    resp1 = client.post(
        "/api/compute/nn/models",
        json={
            "name": "overwrite-test",
            "dataset": "xor",
            "layers": [2, 4, 1],
            "weights": [[[0.1] * 2] * 4, [[0.1] * 4]],
            "biases": [[0.0] * 4, [0.0]],
            "epoch": 50,
            "loss": 0.2,
        },
    )
    assert resp1.status_code == 200
    model_id = resp1.json()["id"]

    # Save again with overwrite_id, updated epoch
    resp2 = client.post(
        "/api/compute/nn/models",
        json={
            "name": "overwrite-test",
            "dataset": "xor",
            "layers": [2, 4, 1],
            "weights": [[[0.2] * 2] * 4, [[0.2] * 4]],
            "biases": [[0.0] * 4, [0.0]],
            "epoch": 100,
            "loss": 0.05,
            "overwrite_id": model_id,
        },
    )
    assert resp2.status_code == 200
    assert resp2.json()["id"] == model_id  # same id

    # List should have only one entry with this id
    list_resp = client.get("/api/compute/nn/models")
    matching = [m for m in list_resp.json()["models"] if m["id"] == model_id]
    assert len(matching) == 1
    assert matching[0]["epoch"] == 100  # updated value

    # Cleanup
    client.delete(f"/api/compute/nn/models/{model_id}")


def test_load_model_not_found(client: TestClient):
    resp = client.get("/api/compute/nn/models/nonexistent_id")
    assert resp.status_code == 400
