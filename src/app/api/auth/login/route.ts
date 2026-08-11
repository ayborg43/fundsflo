import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/users";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const rememberMe = body?.rememberMe !== false;

  const user = await authenticateUser(email, password);
  if (!user) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  await createSession(user.id, rememberMe);
  return NextResponse.json({ email: user.email });
}
