"""Tests for the CNN compute endpoints."""

from fastapi.testclient import TestClient


def test_cnn_convolve(client: TestClient):
    resp = client.post(
        "/api/compute/cnn/convolve",
        json={
            "image": [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
            ],
            "kernel": [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ],
            "stride": 1,
            "padding": 0,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    # 4x4 image, 3x3 kernel -> 2x2 output
    assert len(data["output"]) == 2
    assert len(data["output"][0]) == 2
    # Steps: 2*2 = 4 sliding positions
    assert len(data["steps"]) == 4
    step0 = data["steps"][0]
    assert "receptive_field" in step0
    assert "result" in step0


def test_cnn_convolve_stride2(client: TestClient):
    resp = client.post(
        "/api/compute/cnn/convolve",
        json={
            "image": [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
            "kernel": [[1, 1], [1, 1]],
            "stride": 2,
        },
    )
    assert resp.status_code == 200
    out = resp.json()["output"]
    # 4x4, kernel 2x2, stride 2 -> 2x2
    assert len(out) == 2
    assert len(out[0]) == 2


def test_cnn_pool_max(client: TestClient):
    resp = client.post(
        "/api/compute/cnn/pool",
        json={
            "feature_map": [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
            ],
            "pool_size": 2,
            "stride": 2,
            "mode": "max",
        },
    )
    assert resp.status_code == 200
    out = resp.json()["output"]
    assert out == [[6, 8], [14, 16]]


def test_cnn_pool_avg(client: TestClient):
    resp = client.post(
        "/api/compute/cnn/pool",
        json={
            "feature_map": [[1, 2], [3, 4]],
            "pool_size": 2,
            "stride": 2,
            "mode": "avg",
        },
    )
    assert resp.status_code == 200
    out = resp.json()["output"]
    assert len(out) == 1
    assert abs(out[0][0] - 2.5) < 1e-6
