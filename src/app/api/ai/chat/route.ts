import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { listAccounts } from "@/lib/accounts";
import { listCategories } from "@/lib/categories";
import { getMessages, getPromptMessages, saveMessage } from "@/lib/ai/messages";
import { buildFinancialContext, buildSystemPrompt } from "@/lib/ai/context";
import { extractChatIntent } from "@/lib/ai/extract";
import { streamChatCompletion, type ChatMessage } from "@/lib/ai/client";
import { friendlyAIError } from "@/lib/ai/errors";

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

  // Does this message record money, or ask for a new category? Run this BEFORE
  // persisting anything: a draft isn't committed until the user confirms it on
  // the card, so saving the message now would leave an orphan turn in the
  // history (and in the context every later answer is built from) if they
  // cancel.
  const intent = await intentFromMessage(userId, content, user.currency, user.defaultAccountId);
  if (intent) {
    return NextResponse.json({ ...intent, userText: content });
  }

  await saveMessage(userId, "user", content);

  const [history, context] = await Promise.all([
    getPromptMessages(userId),
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
    return NextResponse.json({ error: friendlyAIError(err, "chat") }, { status: 502 });
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

// A failed extraction must never cost the user their message -- if the
// classifier call errors out, fall through and answer as normal chat.
async function intentFromMessage(
  userId: string,
  content: string,
  currency: string,
  defaultAccountId: string | null
) {
  try {
    const [accounts, categories] = await Promise.all([
      listAccounts(userId),
      listCategories(userId),
    ]);
    return await extractChatIntent(content, {
      accounts,
      categories,
      currency,
      defaultAccountId,
    });
  } catch {
    return null;
  }
}
