// Generic OpenAI-compatible chat-completions client. Deliberately provider
// agnostic -- reads AI_BASE_URL/AI_API_KEY/AI_MODEL from env with zero
// provider-specific assumptions, so swapping providers is a config change,
// not a code change.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// Carries the upstream HTTP status so callers can tell "the provider is busy"
// from "the request was wrong" without string-matching the message.
export class AIRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AIRequestError";
  }
}

function getConfig() {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL ?? "auto/chat";
  if (!baseUrl) throw new Error("AI_BASE_URL must be set");
  if (!apiKey) throw new Error("AI_API_KEY must be set");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model };
}

async function requestCompletion(
  messages: ChatMessage[],
  stream: boolean,
  extra: Record<string, unknown> = {}
) {
  const { baseUrl, apiKey, model } = getConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream, ...extra }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AIRequestError(`AI request failed (${res.status}): ${text.slice(0, 500)}`, res.status);
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

export type ToolCall = { name: string; args: Record<string, unknown> };

type ToolCallAccumulator = { name: string; args: string };

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// Ask the model which actions the message calls for.
//
// Providers disagree about framing here: this one answers with SSE whenever
// `tools` is present, even with stream:false, and arguments arrive split
// across chunks. So handle both shapes -- accumulate deltas if it streams,
// read choices[0].message if it does not.
export async function requestToolCalls(
  messages: ChatMessage[],
  tools: unknown[]
): Promise<{ toolCalls: ToolCall[]; text: string }> {
  const res = await requestCompletion(messages, false, { tools, tool_choice: "auto" });
  const body = await res.text();

  if (!body.trimStart().startsWith("data:")) {
    const data = JSON.parse(body);
    const message = data.choices?.[0]?.message ?? {};
    const calls = (message.tool_calls ?? []) as {
      function?: { name?: string; arguments?: string };
    }[];
    return {
      toolCalls: calls
        .filter((c) => c.function?.name)
        .map((c) => ({
          name: c.function!.name!,
          args: parseArguments(c.function!.arguments ?? ""),
        })),
      text: typeof message.content === "string" ? message.content : "",
    };
  }

  const slots = new Map<number, ToolCallAccumulator>();
  let text = "";

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }

    const delta = parsed.choices?.[0]?.delta ?? {};
    if (typeof delta.content === "string") text += delta.content;

    for (const call of delta.tool_calls ?? []) {
      const index = typeof call.index === "number" ? call.index : 0;
      const slot = slots.get(index) ?? { name: "", args: "" };
      if (call.function?.name) slot.name = call.function.name;
      if (call.function?.arguments) slot.args += call.function.arguments;
      slots.set(index, slot);
    }
  }

  return {
    toolCalls: [...slots.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, slot]) => slot)
      .filter((slot) => slot.name)
      .map((slot) => ({ name: slot.name, args: parseArguments(slot.args) })),
    text,
  };
}
