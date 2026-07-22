/** Chapter-related API calls. */

import { apiGet } from "./client";
import type { Chapter, ChapterSummary } from "@/types/chapter";

export async function fetchChapters(): Promise<ChapterSummary[]> {
  const data = await apiGet<{ chapters: ChapterSummary[] }>("/chapters");
  return data.chapters;
}

export async function fetchChapter(id: number): Promise<Chapter> {
  return apiGet<Chapter>(`/chapters/${id}`);
}
