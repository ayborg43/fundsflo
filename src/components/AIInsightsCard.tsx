"use client";

import { useState } from "react";
import Link from "next/link";
import Markdown from "@/components/Markdown";

type Kind = "recap" | "forecast";

export default function AIInsightsCard() {
  const [loading, setLoading] = useState<Kind | null>(null);
  const [result, setResult] = useState<{ kind: Kind; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsight(kind: Kind) {
    setLoading(kind);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/ai/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setResult({ kind, text: data.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      data-testid="ai-insights-card"
      className="chunky-card p-5 sm:p-6 mt-3"
      style={{ backgroundColor: "var(--gus-pink)" }}
    >
      <h2 className="font-display text-2xl text-white mb-3">MONEY BUDDY</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <Link
          href="/"
          data-testid="open-chat-link"
          className="chunky-btn px-4 py-2 text-sm text-navy"
          style={{ backgroundColor: "white" }}
        >
          💬 Chat
        </Link>
        <button
          data-testid="get-recap-btn"
          onClick={() => fetchInsight("recap")}
          disabled={loading !== null}
          className="chunky-btn px-4 py-2 text-sm text-navy"
          style={{ backgroundColor: "var(--gus-yellow)" }}
        >
          {loading === "recap" ? "..." : "✨ My Recap"}
        </button>
        <button
          data-testid="get-forecast-btn"
          onClick={() => fetchInsight("forecast")}
          disabled={loading !== null}
          className="chunky-btn px-4 py-2 text-sm text-navy"
          style={{ backgroundColor: "var(--gus-cyan)" }}
        >
          {loading === "forecast" ? "..." : "🔮 Forecast"}
        </button>
      </div>

      {result && (
        <div
          data-testid={`ai-${result.kind}-result`}
          className="rounded-2xl border-2 border-navy bg-white p-3 text-sm leading-relaxed text-navy"
        >
          <Markdown text={result.text} />
        </div>
      )}
      {error && (
        <div className="font-display text-sm text-white bg-navy rounded-2xl p-3">{error}</div>
      )}
    </div>
  );
}
