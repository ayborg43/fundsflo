import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { generateInsight, RECAP_REQUEST } from "@/lib/ai/insights";
import { friendlyAIError } from "@/lib/ai/errors";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = checkRateLimit(userId, "insight");
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSeconds);

  try {
    const text = await generateInsight({
      userId,
      currency: user.currency,
      request: RECAP_REQUEST,
    });
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: friendlyAIError(err, "recap") }, { status: 502 });
  }
}
