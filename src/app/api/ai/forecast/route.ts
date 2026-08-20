import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { generateInsight, FORECAST_REQUEST } from "@/lib/ai/insights";
import { friendlyAIError } from "@/lib/ai/errors";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const text = await generateInsight({
      userId,
      currency: user.currency,
      request: FORECAST_REQUEST,
    });
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: friendlyAIError(err, "forecast") }, { status: 502 });
  }
}
