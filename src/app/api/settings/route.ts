import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { updateUserCurrency } from "@/lib/users";
import { isCurrencyCode } from "@/lib/currency";

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currency = body?.currency;

  if (typeof currency !== "string" || !isCurrencyCode(currency)) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const user = await updateUserCurrency(userId, currency);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ currency: user.currency });
}
