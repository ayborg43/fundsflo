import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listCategories, createCategory, deleteCategory } from "@/lib/categories";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const categories = await listCategories(userId);
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 30) : "";
  const emoji = typeof body?.emoji === "string" && body.emoji ? body.emoji : "🏷️";

  if (!name) {
    return NextResponse.json({ error: "Enter a category name" }, { status: 400 });
  }

  const category = await createCategory(userId, { name, emoji });
  return NextResponse.json({ category });
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

  await deleteCategory(userId, id);
  return NextResponse.json({ ok: true });
}
