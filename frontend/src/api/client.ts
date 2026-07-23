/** Lightweight fetch wrapper with JSON handling, error normalization, and AbortController support. */

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, { signal });
  if (!resp.ok) {
    throw new ApiError(`GET ${path} failed`, resp.status, await resp.json().catch(() => null));
  }
  return resp.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    throw new ApiError(`POST ${path} failed`, resp.status, await resp.json().catch(() => null));
  }
  return resp.json() as Promise<T>;
}

export async function apiDelete<T>(path: string, signal?: AbortSignal): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, { method: "DELETE", signal });
  if (!resp.ok) {
    throw new ApiError(`DELETE ${path} failed`, resp.status, await resp.json().catch(() => null));
  }
  return resp.json() as Promise<T>;
}

/** Create an AbortController that auto-aborts after a timeout (ms). */
export function createTimeoutController(timeoutMs = 30000): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    cleanup: () => clearTimeout(timer),
  };
}
