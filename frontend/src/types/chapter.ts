/** Shared types matching the backend Pydantic models. */

export type ContentBlockType = "text" | "formula" | "code" | "note" | "image";

export interface ContentBlock {
  type: ContentBlockType;
  text: string;
  meta?: Record<string, string>;
}

export type ControlType = "slider" | "button" | "select" | "toggle";

export interface ControlConfig {
  key: string;
  label: string;
  type: ControlType;
  min: number;
  max: number;
  step: number;
  default: number;
  options: string[];
  value_labels?: string[];
  api_endpoint?: string;
}

export interface Page {
  id: string;
  title: string;
  visualization: string;
  description: string;
  content: ContentBlock[];
  controls: ControlConfig[];
  api_endpoint?: string;
}

export interface ChapterSummary {
  id: number;
  title: string;
  subtitle: string;
  page_count: number;
  icon: string;
}

export interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  pages: Page[];
}
