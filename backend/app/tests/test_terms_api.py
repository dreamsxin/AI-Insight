"""Tests for the terms API endpoints."""

from fastapi.testclient import TestClient


def test_list_terms(client: TestClient):
    resp = client.get("/api/terms")
    assert resp.status_code == 200
    data = resp.json()
    assert "terms" in data
    terms = data["terms"]
    assert len(terms) == 100
    t0 = terms[0]
    for key in ("id", "zh", "en", "category", "short", "detail"):
        assert key in t0


def test_get_term_by_id(client: TestClient):
    resp = client.get("/api/terms/5")
    assert resp.status_code == 200
    term = resp.json()
    assert term["id"] == 5
    assert "zh" in term


def test_get_term_not_found(client: TestClient):
    resp = client.get("/api/terms/999")
    assert resp.status_code == 404
