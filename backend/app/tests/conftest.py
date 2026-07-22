"""Pytest configuration and fixtures."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure backend/ is on sys.path for imports
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402


@pytest.fixture
def client():
    """FastAPI TestClient for integration tests."""
    return TestClient(app)
