import { NextResponse } from "next/server";
import { getAccount } from "@/lib/store";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const account = await getAccount(userId);
  return NextResponse.json(account);
}
