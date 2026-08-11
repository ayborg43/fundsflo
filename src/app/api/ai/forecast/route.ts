import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { buildFinancialContext, buildSystemPrompt } from "@/lib/ai/context";
import { getChatCompletion } from "@/lib/ai/client";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const context = await buildFinancialContext(userId, user.currency);

  try {
    const text = await getChatCompletion([
      { role: "system", content: buildSystemPrompt(context) },
      {
        role: "user",
        content:
          "Based on my recent earning and spending pace, give me a short, friendly estimate of where my balances are headed over the next week or two. Be explicit that this is a rough, directional estimate from recent trends, not a guarantee or precise prediction.",
      },
    ]);
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
