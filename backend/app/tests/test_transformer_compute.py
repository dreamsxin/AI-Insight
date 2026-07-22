"""Tests for the Transformer compute endpoints."""

from fastapi.testclient import TestClient


def test_attention_basic(client: TestClient):
    resp = client.post(
        "/api/compute/transformer/attention",
        json={
            "sequence": [
                [1.0, 0.0],
                [0.0, 1.0],
                [0.5, 0.5],
            ],
            "causal_mask": False,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    seq_len = 3
    for key in ("q", "k", "v", "scores", "weights", "output"):
        assert key in data
        assert len(data[key]) == seq_len
    # Weights rows should sum to ~1 (softmax)
    for row in data["weights"]:
        assert abs(sum(row) - 1.0) < 1e-5


def test_attention_causal_mask(client: TestClient):
    resp = client.post(
        "/api/compute/transformer/attention",
        json={
            "sequence": [[1.0, 0.0], [0.0, 1.0], [0.5, 0.5]],
            "causal_mask": True,
        },
    )
    assert resp.status_code == 200
    weights = resp.json()["weights"]
    seq_len = 3
    # Upper triangle should be ~0 (masked positions)
    for i in range(seq_len):
        for j in range(i + 1, seq_len):
            assert weights[i][j] < 1e-4


def test_positional_encoding(client: TestClient):
    resp = client.post(
        "/api/compute/transformer/positional_encoding",
        json={"seq_len": 8, "dim": 16},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "encoding" in data
    pe = data["encoding"]
    assert len(pe) == 8
    assert len(pe[0]) == 16
    # Each position's encoding should be different
    assert pe[0] != pe[1]
