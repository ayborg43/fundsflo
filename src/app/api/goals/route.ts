import { NextRequest, NextResponse } from "next/server";
import { addGoal, deleteGoal } from "@/lib/store";
import { getSessionUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { name, price } = body ?? {};

  if (typeof name !== "string" || !name.trim() || typeof price !== "number" || !(price > 0)) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  const account = await addGoal(userId, { name: name.trim().slice(0, 50), price });
  return NextResponse.json(account);
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
  const account = await deleteGoal(userId, id);
  return NextResponse.json(account);
}
