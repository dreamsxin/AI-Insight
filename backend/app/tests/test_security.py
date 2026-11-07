"""P0/P1 回归测试：受限表达式求值、模型 id 路径、计算端点入参与调度。

对应 docs/research/project-audit-2026-11-07.md 的 P0-1 / P0-2 / P0-3 / P1-6。
"""

from __future__ import annotations

import inspect

import pytest
from fastapi import HTTPException

from app.agent.expr import evaluate_arithmetic
from app.agent.teaching_tools import build_teaching_registry
from app.routers.compute import _safe, nn_train_endpoint, transformer_pe_endpoint
from app.services.model_store import delete_model, load_model, save_model

MODEL_KWARGS = {
    "name": "audit-test",
    "dataset": "xor",
    "layers": [2, 3, 1],
    "weights": [[[0.1]]],
    "biases": [[0.0]],
    "epoch": 1,
    "loss": 0.2,
}


# ---------------------------------------------------------------------------
# P0-1: calculator 必须走 AST 白名单，不能回到 eval
# ---------------------------------------------------------------------------

def test_calculator_basic_arithmetic():
    assert evaluate_arithmetic("1+2*3") == "7"
    assert evaluate_arithmetic("17 + 25") == "42"
    assert evaluate_arithmetic("(1+2)/3") == "1.0"
    assert evaluate_arithmetic("50%") == "0.5"
    assert evaluate_arithmetic("1,000+1") == "1001"


@pytest.mark.parametrize(
    "expr",
    [
        "9**9**9",          # 旧实现的幂运算 DoS
        "2**64",
        "__import__('os')",
        "().__class__",
        "1/0",
        "1e309",
        "9" * 201,          # 长度上限
        "",
    ],
)
def test_calculator_rejects_dangerous_expressions(expr):
    with pytest.raises(ValueError):
        evaluate_arithmetic(expr)


def test_default_teaching_registry_uses_safe_calculator():
    """HTTP /api/agent/chat 的默认工具表也必须拒绝幂运算。"""
    calc = build_teaching_registry().get("calculator")
    assert calc("17 + 25") == "42"
    with pytest.raises(ValueError):
        calc("9**9**9")


# ---------------------------------------------------------------------------
# P0-2: 模型 id 不能越出 saved_models/
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_id", ["../escape", "..", "a/b", "", "x" * 129, "a.json"])
def test_model_store_rejects_unsafe_ids(bad_id):
    # 空串沿用既有语义：等同于「不覆盖」，走新建分支，不参与路径拼接
    if bad_id:
        with pytest.raises(ValueError):
            save_model(**MODEL_KWARGS, overwrite_id=bad_id)
    with pytest.raises(ValueError):
        load_model(bad_id)
    with pytest.raises(ValueError):
        delete_model(bad_id)


def test_save_model_rejects_traversal_over_http(client):
    payload = {
        "name": "audit-test",
        "dataset": "xor",
        "layers": [2, 3, 1],
        "weights": [[[0.1]]],
        "biases": [[0.0]],
        "epoch": 1,
        "loss": 0.2,
        "overwrite_id": "../escape",
    }
    resp = client.post("/api/compute/nn/models", json=payload)
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# P0-3 / P1-6: 端点不阻塞事件循环、入参有界、数值错误转 400
# ---------------------------------------------------------------------------

def test_compute_endpoints_are_sync_so_fastapi_uses_threadpool():
    assert not inspect.iscoroutinefunction(nn_train_endpoint)
    assert not inspect.iscoroutinefunction(transformer_pe_endpoint)


def test_safe_translates_numeric_errors_to_400():
    with pytest.raises(HTTPException) as exc_info:
        _safe(lambda: 1 / 0)
    assert exc_info.value.status_code == 400


def test_compute_bounds_reject_hostile_values(client):
    assert client.post(
        "/api/compute/nn/train",
        json={"layers": [2, 2, 1], "data": [[0, 0, 0]], "epochs": 10**9},
    ).status_code == 422
    assert client.post(
        "/api/compute/cnn/convolve",
        json={"image": [[1.0]], "kernel": [[1.0]], "stride": 0},
    ).status_code == 422
    assert client.post(
        "/api/compute/transformer/positional_encoding",
        json={"seq_len": 0, "dim": 16},
    ).status_code == 422
    assert client.post(
        "/api/compute/cnn/pool",
        json={"feature_map": [[1.0, 2.0], [3.0, 4.0]], "mode": "median"},
    ).status_code == 422


# ---------------------------------------------------------------------------
# P1-1 / P1-5: Agent 错误映射与检查点原子写
# ---------------------------------------------------------------------------

def test_agent_error_http_mapping():
    from app.agent import ToolNotAllowedError, ToolNotFoundError, ValidationError
    from app.routers.agent import _http_status

    assert _http_status(ValidationError("bad")) == 400
    assert _http_status(ToolNotFoundError("x")) == 400
    assert _http_status(ToolNotAllowedError("x")) == 409


def test_checkpoint_writes_use_unique_temp_files(tmp_path):
    import concurrent.futures
    import json

    from app.agent import JsonCheckpointStore, Message

    store = JsonCheckpointStore(tmp_path)

    def write(i: int) -> None:
        store.save("s1", [Message.user(f"msg-{i}")])

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(write, range(30)))

    data = json.loads((tmp_path / "s1.json").read_text(encoding="utf-8"))
    assert len(data) == 1
    assert not [p for p in tmp_path.iterdir() if p.suffix == ".tmp"]
