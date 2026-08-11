import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { getMessages, saveMessage } from "@/lib/ai/messages";
import { buildFinancialContext, buildSystemPrompt } from "@/lib/ai/context";
import { streamChatCompletion, type ChatMessage } from "@/lib/ai/client";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const messages = await getMessages(userId);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  await saveMessage(userId, "user", content);

  const [history, context] = await Promise.all([
    getMessages(userId),
    buildFinancialContext(userId, user.currency),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(context) },
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ];

  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await streamChatCompletion(messages);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const decoder = new TextDecoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        controller.enqueue(value);
      }
      controller.close();
      if (fullText.trim()) {
        await saveMessage(userId, "assistant", fullText.trim());
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
