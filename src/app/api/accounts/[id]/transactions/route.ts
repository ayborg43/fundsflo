import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { addTransaction, deleteTransaction } from "@/lib/transactions";

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
  const { type, amount, description, tag, categoryId } = body ?? {};

  if ((type !== "make" && type !== "spend") || typeof amount !== "number" || !(amount > 0)) {
    return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
  }

  try {
    const account = await addTransaction(userId, accountId, {
      type,
      amount,
      description: typeof description === "string" ? description : "",
      tag: typeof tag === "string" && tag ? tag : null,
      categoryId: typeof categoryId === "string" && categoryId ? categoryId : null,
    });
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
  const txId = request.nextUrl.searchParams.get("id");
  if (!txId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const account = await deleteTransaction(userId, accountId, txId);
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
}
