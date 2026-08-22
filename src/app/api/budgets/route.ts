import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listBudgets, upsertBudget, deleteBudget } from "@/lib/budgets";
import type { BudgetPeriod } from "@/lib/types";

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
  // `monthlyLimit` is still accepted so the existing screen keeps working now
  // that budgets can also be daily or weekly.
  const rawLimit = body?.limitAmount ?? body?.monthlyLimit;
  const limitAmount = typeof rawLimit === "number" ? rawLimit : 0;
  const period: BudgetPeriod =
    body?.period === "day" || body?.period === "week" ? body.period : "month";

  if (!categoryId || !(limitAmount > 0)) {
    return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
  }

  const budget = await upsertBudget(userId, { categoryId, limitAmount, period });
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
