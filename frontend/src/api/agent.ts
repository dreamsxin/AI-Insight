/** Agent API - typed wrapper for the agent runtime endpoints. */

import { apiPost } from "./client";

export interface AgentChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  system_prompt?: string;
  max_steps?: number;
  temperature?: number;
}

export interface AgentTraceStep {
  type: "tool_call" | "tool_result";
  id: string;
  name: string;
  arguments?: Record<string, unknown> | null;
  content?: string | null;
  is_error?: boolean;
}

export interface AgentChatResponse {
  output: string;
  steps: number;
  finish_reason: string;
  trace: AgentTraceStep[];
}

/** Run one agent loop turn. Errors surface as ApiError (status + detail). */
export function agentChat(req: AgentChatRequest, signal?: AbortSignal): Promise<AgentChatResponse> {
  return apiPost<AgentChatResponse>("/agent/chat", req, signal);
}
