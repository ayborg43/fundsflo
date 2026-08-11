import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  let user;
  try {
    user = await createUser(email, password);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create account";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  await createSession(user.id);
  return NextResponse.json({ email: user.email });
}
