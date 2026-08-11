import { NextRequest, NextResponse } from "next/server";
import { addTransaction, deleteTransaction } from "@/lib/store";
import { getSessionUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { type, amount, description, tag } = body ?? {};

  if ((type !== "make" && type !== "spend") || typeof amount !== "number" || !(amount > 0)) {
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  }

  const account = await addTransaction(userId, {
    type,
    amount,
    description: typeof description === "string" ? description : "",
    tag: typeof tag === "string" && tag ? tag : null,
  });

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
  const account = await deleteTransaction(userId, id);
  return NextResponse.json(account);
}
