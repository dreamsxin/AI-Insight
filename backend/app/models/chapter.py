"""Pydantic models for chapter and page content."""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ContentBlockType(str, Enum):
    """Supported content block types rendered on a page."""

    TEXT = "text"
    FORMULA = "formula"
    CODE = "code"
    NOTE = "note"
    IMAGE = "image"


class ContentBlock(BaseModel):
    """A single piece of textual/visual content within a page."""

    type: ContentBlockType = ContentBlockType.TEXT
    text: str = ""
    # Optional structured payload (e.g. formula LaTeX, code language, etc.)
    meta: dict[str, Any] = Field(default_factory=dict)


class ControlType(str, Enum):
    """Interaction control types for the controls panel."""

    SLIDER = "slider"
    BUTTON = "button"
    SELECT = "select"
    TOGGLE = "toggle"


class ControlConfig(BaseModel):
    """Declarative control configuration consumed by the frontend."""

    key: str
    label: str
    type: ControlType = ControlType.SLIDER
    min: float = 0.0
    max: float = 1.0
    step: float = 0.01
    default: float = 0.0
    options: list[str] = Field(default_factory=list)  # for SELECT
    # Optional backend endpoint to call when the control value changes.
    api_endpoint: Optional[str] = None


class Page(BaseModel):
    """A single page within a chapter."""

    id: str
    title: str
    visualization: str
    description: str = ""
    content: list[ContentBlock] = Field(default_factory=list)
    controls: list[ControlConfig] = Field(default_factory=list)
    api_endpoint: Optional[str] = None


class ChapterSummary(BaseModel):
    """Lightweight chapter info for the sidebar listing."""

    id: int
    title: str
    subtitle: str
    page_count: int
    icon: str = ""


class Chapter(BaseModel):
    """Full chapter with all pages."""

    id: int
    title: str
    subtitle: str
    icon: str = ""
    pages: list[Page] = Field(default_factory=list)
