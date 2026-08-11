import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { addGoal, deleteGoal } from "@/lib/transactions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: accountId } = await params;
  const body = await request.json().catch(() => null);
  const { name, price } = body ?? {};

  if (typeof name !== "string" || !name.trim() || typeof price !== "number" || !(price > 0)) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  try {
    const account = await addGoal(userId, accountId, { name: name.trim().slice(0, 50), price });
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: accountId } = await params;
  const goalId = request.nextUrl.searchParams.get("id");
  if (!goalId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const account = await deleteGoal(userId, accountId, goalId);
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
}
