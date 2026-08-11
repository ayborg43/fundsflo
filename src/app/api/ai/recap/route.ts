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
          "Give me a short, encouraging recap of my recent spending and earning activity. Point out one or two interesting patterns. A few sentences, not an essay.",
      },
    ]);
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
