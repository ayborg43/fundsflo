import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { markBillPaid } from "@/lib/bills";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const bill = await markBillPaid(userId, id);
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  return NextResponse.json({ bill });
}
