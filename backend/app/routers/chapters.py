"""Chapters API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.data.chapters import get_chapter, get_chapter_summaries

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("")
async def list_chapters():
    """Return all chapter summaries for the sidebar."""
    return {"chapters": get_chapter_summaries()}


@router.get("/{chapter_id}")
async def get_chapter_detail(chapter_id: int):
    """Return the full chapter with all pages."""
    chapter = get_chapter(chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")
    return chapter
