import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listCategories, createCategory } from "@/lib/categories";
import { saveMessage } from "@/lib/ai/messages";

const FALLBACK_EMOJI = "🏷️";

// Commits a category the user confirmed on the chat card. Mirrors
// /api/ai/log: the card's current values are what gets written, and the
// confirmation is composed here rather than generated, because it states what
// now exists.
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  const emojiRaw = typeof body?.emoji === "string" ? body.emoji.trim() : "";
  const userText = typeof body?.userText === "string" ? body.userText.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Give the category a name" }, { status: 400 });
  }

  // Categories are matched by name elsewhere (CSV import, the AI's own
  // numbered list), so a near-duplicate is worse than a rejection.
  const existing = await listCategories(userId);
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: `You already have a "${name}" category` }, { status: 409 });
  }

  const emoji = emojiRaw ? [...emojiRaw].slice(0, 4).join("") : FALLBACK_EMOJI;
  const category = await createCategory(userId, { name, emoji });

  const confirmation = `Made you a ${category.emoji} ${category.name} category! Tag spending with it any time. 🎉`;

  if (userText) {
    await saveMessage(userId, "user", userText);
  }
  await saveMessage(userId, "assistant", confirmation);

  return NextResponse.json({ confirmation, category });
}
