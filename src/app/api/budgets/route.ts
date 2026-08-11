import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listBudgets, createBudget, deleteBudget } from "@/lib/budgets";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const budgets = await listBudgets(userId);
  return NextResponse.json({ budgets });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const monthlyLimit = typeof body?.monthlyLimit === "number" ? body.monthlyLimit : 0;

  if (!categoryId || !(monthlyLimit > 0)) {
    return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
  }

  const budget = await createBudget(userId, { categoryId, monthlyLimit });
  return NextResponse.json({ budget });
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
  await deleteBudget(userId, id);
  return NextResponse.json({ ok: true });
}
