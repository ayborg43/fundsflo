"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Confetti, { makeConfettiPieces } from "@/components/Confetti";
import TransactionDraftCard from "@/components/TransactionDraftCard";
import CategoryDraftCard from "@/components/CategoryDraftCard";
import { formatMoney } from "@/lib/format";
import type { AccountSummary, Category, CategoryDraft, TransactionDraft } from "@/lib/types";

type Message = { id: string; role: "user" | "assistant"; content: string };

// Something the AI parsed but nobody has confirmed yet. `userText` is held
// here rather than saved server-side: the message only becomes history once
// the draft is committed, so cancelling leaves no trace in the chat or in the
// context later answers are built from.
type Pending =
  | { kind: "transaction"; userText: string; draft: TransactionDraft }
  | { kind: "category"; userText: string; draft: CategoryDraft };

let localId = 0;
function nextId(role: string): string {
  localId += 1;
  return `local-${role}-${localId}`;
}

export default function ChatView({ email, currency }: { email: string; currency: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Which one-shot action is in flight ("recap" | "forecast" | "upload"), so
  // the whole composer can lock without a boolean per button.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<ReturnType<typeof makeConfettiPieces>>([]);
  // The entry most recently logged from the chat, kept only until the next
  // action, so Undo always refers to something unambiguous.
  const [lastLog, setLastLog] = useState<{ transactionId: string; accountId: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const locked = sending || savingDraft || busy !== null || pending !== null;

  useEffect(() => {
    fetch("/api/ai/chat")
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []));
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts ?? []));
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, busy]);

  useEffect(() => {
    if (confetti.length === 0) return;
    const timer = setTimeout(() => setConfetti([]), 3000);
    return () => clearTimeout(timer);
  }, [confetti]);

  function appendTurn(userText: string, assistantText: string) {
    setMessages((prev) => [
      ...prev,
      { id: nextId("user"), role: "user", content: userText },
      { id: nextId("assistant"), role: "assistant", content: assistantText },
    ]);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || locked) return;

    setInput("");
    setError(null);
    setLastLog(null);
    setSending(true);

    const assistantId = nextId("assistant");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      // The route answers one of two ways: JSON when the message turned out to
      // be something to confirm, or a plain-text stream for a real answer.
      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
        if (data?.kind === "transaction" || data?.kind === "category") {
          setPending({ ...data, userText: data.userText ?? content });
          return;
        }
        throw new Error(data?.error ?? "Something went wrong");
      }

      if (!res.ok || !res.body) throw new Error("Something went wrong");

      setMessages((prev) => [
        ...prev,
        { id: nextId("user"), role: "user", content },
        { id: assistantId, role: "assistant", content: "" },
      ]);

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
      setInput(content);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setSending(false);
    }
  }

  async function saveDraft() {
    if (!pending) return;
    setSavingDraft(true);
    setDraftError(null);
    try {
      const endpoint = pending.kind === "transaction" ? "/api/ai/log" : "/api/ai/category";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pending.draft, userText: pending.userText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not save that");

      appendTurn(pending.userText, data.confirmation);
      if (data.accounts) setAccounts(data.accounts);
      if (data.category) setCategories((prev) => [...prev, data.category]);
      if (data.transactionId && data.accountId) {
        setLastLog({ transactionId: data.transactionId, accountId: data.accountId });
      }
      if (pending.kind === "transaction" && pending.draft.type === "make") {
        setConfetti(makeConfettiPieces());
      }
      setPending(null);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setSavingDraft(false);
    }
  }

  function cancelDraft() {
    // Put the words back in the box so a wrong reading can be rephrased
    // instead of retyped.
    setInput(pending?.userText ?? "");
    setPending(null);
    setDraftError(null);
  }

  async function undoLastLog() {
    if (!lastLog || locked) return;
    setBusy("undo");
    setError(null);
    try {
      const res = await fetch("/api/ai/log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastLog),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not undo that");
      setMessages((prev) => [
        ...prev,
        { id: nextId("assistant"), role: "assistant", content: data.confirmation },
      ]);
      if (data.accounts) setAccounts(data.accounts);
      setLastLog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo that");
    } finally {
      setBusy(null);
    }
  }

  async function uploadStatement(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || locked) return;

    setBusy("upload");
    setError(null);
    setLastLog(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fromChat", "1");
      const res = await fetch("/api/statements", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not read that file");
      // The route saves the statement even when analysis fails, so an error
      // alongside a statement means "uploaded, but no commentary".
      if (!data?.statement?.analysis) {
        throw new Error(data?.error ?? "Uploaded, but I couldn't analyse it");
      }
      appendTurn(data.chatLabel ?? `📄 Uploaded ${file.name}`, data.statement.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file");
    } finally {
      setBusy(null);
    }
  }

  // Debt balances are stored negative, so a plain sum already nets them off.
  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div
      data-testid="chat-view"
      className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-4 flex flex-col"
      style={{ height: "100dvh" }}
    >
      <Confetti pieces={confetti} />

      <AppHeader title="FUNDSFLOW" onLogout={handleLogout} />

      <div
        data-testid="net-worth-line"
        className="flex items-center justify-between font-display text-navy -mt-3 mb-3 px-1"
      >
        <span className="text-sm text-navy/60 uppercase tracking-wide truncate">{email}</span>
        <span className="text-xl whitespace-nowrap">{formatMoney(netWorth, currency)}</span>
      </div>

      <div
        data-testid="chat-messages"
        className="flex-1 overflow-y-auto chunky-card p-4 sm:p-5 mb-3"
        style={{ backgroundColor: "white" }}
      >
        {messages.length === 0 && !pending && !busy ? (
          <div className="font-display text-navy/60 text-center mt-8 px-2">
            <p className="text-lg mb-2">Just tell me what happened! 💬</p>
            <p className="text-sm">
              Try &ldquo;spent 12 on lunch&rdquo;, &ldquo;made 50 from chores&rdquo;, or
              &ldquo;add a category for pets&rdquo;. Ask me to review your spending or where
              you&rsquo;re headed, or send me a statement with 📎.
            </p>
            {accounts.length === 0 && (
              <p className="text-sm mt-3">
                Add an account from the menu first so I have somewhere to put it.
              </p>
            )}
          </div>
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

            {pending && (
              <>
                <div className="flex justify-end">
                  <div
                    data-testid="chat-msg-user"
                    className="font-display max-w-[80%] rounded-2xl px-4 py-2 border-3 border-navy whitespace-pre-wrap"
                    style={{ backgroundColor: "var(--gus-cyan)", borderWidth: 3 }}
                  >
                    {pending.userText}
                  </div>
                </div>
                <div className="flex justify-start">
                  {pending.kind === "transaction" ? (
                    <TransactionDraftCard
                      draft={pending.draft}
                      currency={currency}
                      accounts={accounts}
                      categories={categories}
                      saving={savingDraft}
                      error={draftError}
                      onChange={(next) => setPending({ ...pending, draft: next })}
                      onSave={saveDraft}
                      onCancel={cancelDraft}
                    />
                  ) : (
                    <CategoryDraftCard
                      draft={pending.draft}
                      saving={savingDraft}
                      error={draftError}
                      onChange={(next) => setPending({ ...pending, draft: next })}
                      onSave={saveDraft}
                      onCancel={cancelDraft}
                    />
                  )}
                </div>
              </>
            )}

            {busy && (
              <div className="flex justify-start">
                <div
                  data-testid="chat-busy"
                  className="font-display rounded-2xl px-4 py-2 border-3 border-navy"
                  style={{ backgroundColor: "var(--gus-cream)", borderWidth: 3 }}
                >
                  {busy === "undo" ? "Putting that back… ↩️" : "Reading your statement… 📄"}
                </div>
              </div>
            )}
            {lastLog && !busy && (
              <div className="flex justify-start">
                <button
                  data-testid="undo-log-btn"
                  onClick={undoLastLog}
                  className="chunky-btn px-3 py-2 text-sm text-navy"
                  style={{ backgroundColor: "white" }}
                >
                  ↩️ Undo that
                </button>
              </div>
            )}
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
          ref={fileRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={uploadStatement}
          data-testid="chat-upload-input"
        />
        <button
          type="button"
          data-testid="chat-upload-btn"
          aria-label="Upload a statement"
          onClick={() => fileRef.current?.click()}
          disabled={locked}
          className="chunky-btn px-4 text-xl text-navy disabled:opacity-60"
          style={{ backgroundColor: "white" }}
        >
          📎
        </button>
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pending ? "Confirm above first…" : "Spent 12 on lunch…"}
          disabled={!!pending || busy !== null}
          className="flex-1 font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white min-w-0 disabled:opacity-60"
          style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
        />
        <button
          data-testid="chat-send-btn"
          type="submit"
          disabled={locked || !input.trim()}
          className="chunky-btn px-5 text-xl text-navy"
          style={{ backgroundColor: "var(--gus-lime)" }}
        >
          {sending ? "…" : "→"}
        </button>
      </form>
    </div>
  );
}
