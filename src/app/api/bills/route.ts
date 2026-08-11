import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listBills, createBill, deleteBill } from "@/lib/bills";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const bills = await listBills(userId);
  return NextResponse.json({ bills });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 50) : "";
  const amount = typeof body?.amount === "number" ? body.amount : 0;
  const dueDayOfMonth = typeof body?.dueDayOfMonth === "number" ? body.dueDayOfMonth : 0;
  const accountId = typeof body?.accountId === "string" && body.accountId ? body.accountId : null;
  const categoryId = typeof body?.categoryId === "string" && body.categoryId ? body.categoryId : null;

  if (!name || !(amount > 0) || dueDayOfMonth < 1 || dueDayOfMonth > 28) {
    return NextResponse.json({ error: "Invalid bill" }, { status: 400 });
  }

  const bill = await createBill(userId, { name, amount, dueDayOfMonth, accountId, categoryId });
  return NextResponse.json({ bill });
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await deleteBill(userId, id);
  return NextResponse.json({ ok: true });
}
