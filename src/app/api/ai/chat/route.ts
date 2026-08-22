import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { listAccounts } from "@/lib/accounts";
import { listCategories } from "@/lib/categories";
import { listBills } from "@/lib/bills";
import { getMessages, getPromptMessages, saveMessage } from "@/lib/ai/messages";
import { buildFinancialContext, buildSystemPrompt, buildActionPrompt } from "@/lib/ai/context";
import { buildTools } from "@/lib/ai/tools";
import { proposalsFrom, type Proposal } from "@/lib/ai/propose";
import { streamChatCompletion, requestToolCalls, type ChatMessage } from "@/lib/ai/client";
import { friendlyAIError } from "@/lib/ai/errors";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

  // Each message costs two upstream calls (decide actions, then answer), so
  // the guard goes here -- before either one is made.
  const limited = checkRateLimit(userId, "chat");
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSeconds);

  // Does this message ask for anything to be recorded or changed? Run this
  // BEFORE persisting: proposals are not committed until the user confirms
  // them, so saving the message now would leave an orphan turn in the history
  // (and in the context every later answer is built from) if they cancel.
  const proposals = await proposeActions(userId, content, user.currency, user.defaultAccountId);
  if (proposals.length > 0) {
    return NextResponse.json({ kind: "proposals", proposals, userText: content });
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

// A failed action pass must never cost the user their message -- if the call
// errors out, fall through and answer as normal conversation.
async function proposeActions(
  userId: string,
  content: string,
  currency: string,
  defaultAccountId: string | null
): Promise<Proposal[]> {
  try {
    const [accounts, categories, bills] = await Promise.all([
      listAccounts(userId),
      listCategories(userId),
      listBills(userId),
    ]);

    // Server clock, UTC. Dates only ever seed a proposal, and the user sees
    // and can change them on the card before anything is written.
    const today = new Date().toISOString().slice(0, 10);

    const { toolCalls } = await requestToolCalls(
      [
        {
          role: "system",
          content: buildActionPrompt(accounts, categories, bills, currency, today),
        },
        { role: "user", content },
      ],
      buildTools()
    );

    return proposalsFrom(toolCalls, {
      accounts,
      categories,
      bills,
      defaultAccountId,
      today,
    });
  } catch (err) {
    friendlyAIError(err, "action pass");
    return [];
  }
}
