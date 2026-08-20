// Shared engine for the one-shot insight prompts behind the Insights screen
// (recap, forecast). Both are the same call with a different question, so the
// shape lives here rather than being copy-pasted per route.
//
// The chat deliberately does NOT go through here: asking "review my spending"
// or "where am I headed?" is answered as a normal conversational turn, so it
// keeps the thread's context and can be followed up on.

import { buildFinancialContext, buildSystemPrompt } from "./context";
import { getChatCompletion } from "./client";

export const RECAP_REQUEST =
  "Give me a short, encouraging recap of my recent spending and earning activity. " +
  "Point out one or two interesting patterns. A few sentences, not an essay.";

export const FORECAST_REQUEST =
  "Based on my recent earning and spending pace, give me a short, friendly estimate of " +
  "where my balances are headed over the next week or two. Be explicit that this is a " +
  "rough, directional estimate from recent trends, not a guarantee or precise prediction.";

export async function generateInsight(opts: {
  userId: string;
  currency: string;
  request: string;
}): Promise<string> {
  const context = await buildFinancialContext(opts.userId, opts.currency);
  return getChatCompletion([
    { role: "system", content: buildSystemPrompt(context) },
    { role: "user", content: opts.request },
  ]);
}
