// Upstream failures carry provider payloads -- model names, pool diagnostics,
// raw JSON. None of that belongs in a kid-facing chat bubble, and some of it is
// operational detail we shouldn't hand to the browser at all. Log the detail
// server-side, return something short and true.

import { AIRequestError } from "./client";

const BUSY_STATUSES = new Set([408, 429, 502, 503, 504]);

export function friendlyAIError(err: unknown, context: string): string {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[fundsflow] ${context}: ${detail}`);

  if (err instanceof AIRequestError) {
    if (BUSY_STATUSES.has(err.status)) {
      return "Money Buddy is a bit busy right now — try that again in a moment.";
    }
    if (err.status === 401 || err.status === 403) {
      return "Money Buddy isn't set up correctly (check the AI key).";
    }
  }
  return "Money Buddy couldn't answer that right now.";
}
