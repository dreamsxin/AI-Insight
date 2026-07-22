"""Tests for the chapters API endpoints."""

from fastapi.testclient import TestClient


def test_list_chapters(client: TestClient):
    resp = client.get("/api/chapters")
    assert resp.status_code == 200
    data = resp.json()
    assert "chapters" in data
    chapters = data["chapters"]
    assert len(chapters) == 9
    ch1 = chapters[0]
    assert ch1["id"] == 1
    assert ch1["title"] == "从函数到神经网络"
    assert ch1["page_count"] == 3
    assert "icon" in ch1


def test_get_chapter_detail(client: TestClient):
    resp = client.get("/api/chapters/1")
    assert resp.status_code == 200
    ch = resp.json()
    assert ch["id"] == 1
    assert ch["title"] == "从函数到神经网络"
    assert len(ch["pages"]) == 3
    p1 = ch["pages"][0]
    assert p1["id"] == "p1"
    assert p1["visualization"] == "FunctionPlotViz"
    assert len(p1["content"]) >= 1
    assert len(p1["controls"]) >= 1


def test_get_chapter_not_found(client: TestClient):
    resp = client.get("/api/chapters/999")
    assert resp.status_code == 404


def test_forward_pass_page_exposes_network_controls(client: TestClient):
    chapter = client.get("/api/chapters/2").json()
    page = chapter["pages"][1]
    controls = {control["key"]: control for control in page["controls"]}

    assert {"hidden_layers", "hidden", "activation", "run"} <= controls.keys()
    assert controls["hidden_layers"]["value_labels"] == ["1 层", "2 层", "3 层"]


def test_all_chapters_have_pages(client: TestClient):
    """Every chapter should have at least 2 pages."""
    resp = client.get("/api/chapters")
    for ch in resp.json()["chapters"]:
        detail = client.get(f"/api/chapters/{ch['id']}").json()
        assert len(detail["pages"]) >= 2, f"Chapter {ch['id']} has too few pages"
        for page in detail["pages"]:
            assert page["visualization"], f"Page {page['id']} in ch{ch['id']} missing viz"
