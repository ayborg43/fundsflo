"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/chat")
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    setInput("");
    setError(null);
    setSending(true);

    const userMsg: Message = { id: `local-user-${Date.now()}`, role: "user", content };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const text = acc;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      data-testid="chat-view"
      className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-4 flex flex-col"
      style={{ height: "100vh" }}
    >
      <header className="flex items-center justify-between mb-4 gap-2">
        <Link href="/" className="font-display text-xs sm:text-sm text-navy/70 underline w-16">
          ← Back
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl text-navy tracking-tight">MONEY BUDDY</h1>
        <div className="w-16" />
      </header>

      <div
        data-testid="chat-messages"
        className="flex-1 overflow-y-auto chunky-card p-4 sm:p-5 mb-3"
        style={{ backgroundColor: "white" }}
      >
        {messages.length === 0 ? (
          <p className="font-display text-navy/60 text-center mt-8">
            Ask me anything about your money! 💬
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  data-testid={`chat-msg-${m.role}`}
                  className="font-display max-w-[80%] rounded-2xl px-4 py-2 border-3 border-navy whitespace-pre-wrap"
                  style={{
                    backgroundColor: m.role === "user" ? "var(--gus-cyan)" : "var(--gus-cream)",
                    borderWidth: 3,
                  }}
                >
                  {m.content || (m.role === "assistant" ? "..." : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && (
        <div
          data-testid="chat-error"
          className="font-display text-sm text-white px-4 py-2 rounded-2xl mb-2"
          style={{ backgroundColor: "var(--gus-orange)" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your money..."
          className="flex-1 font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white min-w-0"
          style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
        />
        <button
          data-testid="chat-send-btn"
          type="submit"
          disabled={sending || !input.trim()}
          className="chunky-btn px-5 text-xl text-navy"
          style={{ backgroundColor: "var(--gus-lime)" }}
        >
          →
        </button>
      </form>
    </div>
  );
}
