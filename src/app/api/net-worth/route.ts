import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getNetWorthHistory } from "@/lib/networth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const history = await getNetWorthHistory(userId);
  return NextResponse.json({ history });
}
