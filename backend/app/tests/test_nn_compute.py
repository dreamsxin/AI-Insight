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
