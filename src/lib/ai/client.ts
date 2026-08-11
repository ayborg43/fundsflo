// Generic OpenAI-compatible chat-completions client. Deliberately provider
// agnostic -- reads AI_BASE_URL/AI_API_KEY/AI_MODEL from env with zero
// provider-specific assumptions, so swapping providers is a config change,
// not a code change.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function getConfig() {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL ?? "auto/chat";
  if (!baseUrl) throw new Error("AI_BASE_URL must be set");
  if (!apiKey) throw new Error("AI_API_KEY must be set");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}

async function requestCompletion(messages: ChatMessage[], stream: boolean) {
  const { baseUrl, apiKey, model } = getConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return res;
}

// Returns a stream of plain-text content deltas (SSE framing already parsed
// out), so callers never need to know this is OpenAI-style SSE underneath.
export async function streamChatCompletion(
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const res = await requestCompletion(messages, true);
  if (!res.body) throw new Error("AI response had no body");

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const upstream = res.body;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) controller.enqueue(encoder.encode(delta));
          } catch {
            // ignore malformed SSE chunks rather than failing the whole stream
          }
        }
      }
      controller.close();
    },
  });
}

export async function getChatCompletion(messages: ChatMessage[]): Promise<string> {
  const res = await requestCompletion(messages, false);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
