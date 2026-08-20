import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { updateUserCurrency, updateUserDefaultAccount, findUserById } from "@/lib/users";
import { listAccounts } from "@/lib/accounts";
import { isCurrencyCode } from "@/lib/currency";

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Both fields are optional so the settings screen can PATCH whichever one
  // the user just touched, but at least one has to be present -- an empty
  // body is a bug in the caller, not a no-op worth pretending succeeded.
  const hasCurrency = "currency" in body;
  const hasDefaultAccount = "defaultAccountId" in body;
  if (!hasCurrency && !hasDefaultAccount) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (hasCurrency) {
    if (typeof body.currency !== "string" || !isCurrencyCode(body.currency)) {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }
    if (!(await updateUserCurrency(userId, body.currency))) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  }

  if (hasDefaultAccount) {
    const raw = body.defaultAccountId;
    if (raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "Invalid default account" }, { status: 400 });
    }
    if (raw !== null) {
      const owned = await listAccounts(userId);
      if (!owned.some((a) => a.id === raw)) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
    }
    if (!(await updateUserDefaultAccount(userId, raw))) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  }

  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    currency: user.currency,
    defaultAccountId: user.defaultAccountId,
  });
}
