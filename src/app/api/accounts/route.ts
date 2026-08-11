import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listAccounts, createAccount } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

const VALID_TYPES: AccountType[] = ["cash", "checking", "savings", "credit", "debt", "investment"];

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const accounts = await listAccounts(userId);
  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 50) : "";
  const type = body?.type;
  const startingBalance =
    typeof body?.startingBalance === "number" && body.startingBalance > 0
      ? body.startingBalance
      : null;

  if (!name) {
    return NextResponse.json({ error: "Enter an account name" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }

  const account = await createAccount(userId, { name, type, startingBalance });
  return NextResponse.json({ account });
}
