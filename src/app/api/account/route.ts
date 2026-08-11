import { NextResponse } from "next/server";
import { getAccount } from "@/lib/store";

export async function GET() {
  const account = await getAccount();
  return NextResponse.json(account);
}
