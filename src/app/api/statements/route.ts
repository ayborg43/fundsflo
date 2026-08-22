import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionUserId } from "@/lib/auth";
import { listStatements, createStatement, setStatementAnalysis, deleteStatement } from "@/lib/statements";
import { getChatCompletion } from "@/lib/ai/client";
import { saveMessage } from "@/lib/ai/messages";
import { friendlyAIError } from "@/lib/ai/errors";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_CONTENT_CHARS_FOR_AI = 20000;
const MAX_STORED_CHARS = 100000;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const statements = await listStatements(userId);
  return NextResponse.json({ statements });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = checkRateLimit(userId, "statement");
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSeconds);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  // Uploads that came from the chat get the analysis mirrored into chat
  // history, so it reads back as a normal exchange. The Statements screen
  // omits this and behaves exactly as before.
  const fromChat = formData?.get("fromChat") === "1";
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isExcel = /\.xlsx?$/i.test(file.name);

  let content: string;
  try {
    if (isExcel) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      content = XLSX.utils.sheet_to_csv(sheet);
    } else {
      content = buffer.toString("utf-8");
    }
  } catch {
    return NextResponse.json(
      { error: "Could not read this file — is it a valid CSV/Excel file?" },
      { status: 400 }
    );
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "File appears to be empty" }, { status: 400 });
  }

  const { id, createdAt } = await createStatement(userId, {
    filename: file.name,
    rawContent: content.slice(0, MAX_STORED_CHARS),
  });

  const truncated = content.length > MAX_CONTENT_CHARS_FOR_AI;
  const contentForAI = content.slice(0, MAX_CONTENT_CHARS_FOR_AI);

  try {
    const analysis = await getChatCompletion([
      {
        role: "system",
        content:
          "You are Money Buddy, a friendly, upbeat personal finance assistant inside the FundsFlow app. " +
          "The user has uploaded a bank/card statement (CSV, or Excel converted to CSV text below). " +
          "Analyze it: summarize total spending/income if identifiable, call out notable categories or " +
          "large transactions, and share a couple of friendly, encouraging observations. This is general " +
          "commentary, not licensed financial advice. Keep it concise — a few short paragraphs or a short " +
          "list, not an essay." +
          (truncated ? " Note: this file is large, so you're only seeing the first portion of it." : ""),
      },
      { role: "user", content: `Statement filename: ${file.name}\n\n${contentForAI}` },
    ]);
    await setStatementAnalysis(id, analysis);
    const chatLabel = `📄 Uploaded ${file.name}`;
    if (fromChat && analysis.trim()) {
      await saveMessage(userId, "user", chatLabel);
      await saveMessage(userId, "assistant", analysis.trim());
    }
    return NextResponse.json({
      statement: { id, filename: file.name, analysis, createdAt },
      chatLabel: fromChat ? chatLabel : null,
    });
  } catch (err) {
    const message = friendlyAIError(err, "statement analysis");
    // The statement is still saved even if analysis fails, so the upload
    // isn't lost -- delete and re-upload to retry once AI is configured.
    return NextResponse.json({
      statement: { id, filename: file.name, analysis: null, createdAt },
      error: message,
    });
  }
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
  await deleteStatement(userId, id);
  return NextResponse.json({ ok: true });
}
