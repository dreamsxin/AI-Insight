"""Terms API routes – 100 large-model terminology glossary."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/terms", tags=["terms"])

_TERMS_CACHE: list[dict] | None = None


def _load_terms() -> list[dict]:
    """Load the terms JSON lazily and cache it."""
    global _TERMS_CACHE
    if _TERMS_CACHE is None:
        path = Path(__file__).resolve().parent.parent / "data" / "terms.json"
        if not path.exists():
            _TERMS_CACHE = []
        else:
            with open(path, "r", encoding="utf-8") as f:
                _TERMS_CACHE = json.load(f)
    return _TERMS_CACHE


@router.get("")
async def list_terms():
    """Return all terms."""
    return {"terms": _load_terms()}


@router.get("/{term_id}")
async def get_term(term_id: int):
    """Return a single term by index."""
    terms = _load_terms()
    if term_id < 0 or term_id >= len(terms):
        raise HTTPException(status_code=404, detail=f"Term {term_id} not found")
    return terms[term_id]
