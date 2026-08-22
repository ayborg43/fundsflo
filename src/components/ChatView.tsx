"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Confetti, { makeConfettiPieces } from "@/components/Confetti";
import Icon from "@/components/Icon";
import Markdown from "@/components/Markdown";
import ActionCard from "@/components/ActionCard";
import { formatMoney } from "@/lib/format";
import type { AccountSummary, Category } from "@/lib/types";

type Message = { id: string; role: "user" | "assistant"; content: string };

type Proposal = { action: string; values: Record<string, unknown> };

// Actions the AI proposed but nobody has confirmed yet. One message can ask
// for several ("switch me to naira and add my netflix bill"), so they queue and
// are confirmed one card at a time.
//
// `userText` is held here rather than saved server-side: the message only
// becomes history once something is committed, so cancelling everything leaves
// no trace in the chat or in the context later answers are built from.
type Pending = {
  userText: string;
  proposals: Proposal[];
  index: number;
  savedAny: boolean;
};

const OPENERS = ["Spent 12 on lunch", "Made 50 from chores", "Review my spending"];

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
  // Which one-shot action is in flight ("upload" | "undo"), so the whole
  // composer can lock without a boolean per control.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<ReturnType<typeof makeConfettiPieces>>([]);
  // The entry most recently logged from the chat, kept only until the next
  // action, so Undo always refers to something unambiguous.
  const [lastLog, setLastLog] = useState<{ transactionId: string; accountId: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Scroll the transcript, never the page. scrollIntoView used to move the
  // window instead, which pushed the header off-screen.
  //
  // A confirmation card is taller than a reply, so scrolling to the bottom
  // would hide the message that produced it. Bring the top of that exchange
  // into view instead, and only chase the bottom for ordinary messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pending && pendingRef.current) {
      pendingRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
        if (data?.kind === "proposals" && Array.isArray(data.proposals) && data.proposals.length) {
          setPending({
            userText: data.userText ?? content,
            proposals: data.proposals,
            index: 0,
            savedAny: false,
          });
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

  async function confirmAction() {
    if (!pending) return;
    const current = pending.proposals[pending.index];
    setSavingDraft(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/ai/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: current.action,
          values: current.values,
          // The message is filed once, alongside whichever action lands first.
          userText: pending.savedAny ? "" : pending.userText,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not save that");

      setMessages((prev) => [
        ...prev,
        ...(pending.savedAny
          ? []
          : [{ id: nextId("user"), role: "user" as const, content: pending.userText }]),
        { id: nextId("assistant"), role: "assistant" as const, content: data.confirmation },
      ]);

      if (data.accounts) setAccounts(data.accounts);
      if (data.category) setCategories((prev) => [...prev, data.category]);
      if (data.deletedCategoryId) {
        setCategories((prev) => prev.filter((c) => c.id !== data.deletedCategoryId));
      }
      if (data.currency) router.refresh();
      if (data.transactionId && data.accountId) {
        setLastLog({ transactionId: data.transactionId, accountId: data.accountId });
      }
      if (current.action === "log_transaction" && current.values.type === "make") {
        setConfetti(makeConfettiPieces());
      }

      advanceQueue(true);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setSavingDraft(false);
    }
  }

  function advanceQueue(saved: boolean) {
    setPending((prev) => {
      if (!prev) return null;
      const savedAny = prev.savedAny || saved;
      const next = prev.index + 1;
      if (next >= prev.proposals.length) {
        // Nothing at all was confirmed: hand the wording back so a wrong
        // reading can be rephrased instead of retyped.
        if (!savedAny) setInput(prev.userText);
        return null;
      }
      return { ...prev, index: next, savedAny };
    });
    setDraftError(null);
  }

  function skipAction() {
    advanceQueue(false);
    inputRef.current?.focus();
  }

  async function undoLastLog() {
    if (!lastLog || locked) return;
    setBusy("undo");
    setError(null);
    try {
      const res = await fetch("/api/ai/act", {
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
  const today = new Date().toISOString().slice(0, 10);
  const inTheRed = netWorth < 0;
  const isEmpty = messages.length === 0 && !pending && !busy;

  return (
    // Fixed to the viewport: the page itself must never scroll here, or the
    // header slides away as the transcript grows.
    <div data-testid="chat-view" className="fixed inset-0 flex flex-col overflow-hidden">
      <Confetti pieces={confetti} />

      <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pb-4 pt-5 sm:px-6 sm:pt-7">
        <AppHeader title="FUNDSFLOW" email={email} onLogout={handleLogout} />

        <div
          data-testid="net-worth-line"
          className="-mt-3 mb-3 flex shrink-0 items-baseline justify-between px-1"
        >
          <span className="font-display text-xs uppercase tracking-[0.14em] text-ink-2">
            Net worth
          </span>
          <span
            className="font-display tnum text-2xl"
            style={{ color: inTheRed ? "var(--gus-orange)" : "var(--gus-navy)" }}
          >
            {formatMoney(netWorth, currency)}
          </span>
        </div>

        <div
          ref={scrollRef}
          data-testid="chat-messages"
          className="chunky-card mb-3 min-h-0 flex-1 overflow-y-auto"
        >
          <div
            className={`flex min-h-full flex-col gap-3 p-4 sm:p-5 ${
              isEmpty ? "justify-center" : "justify-end"
            }`}
          >
            {isEmpty ? (
              <div className="text-center">
                <p className="font-display text-2xl text-navy">Tell me what happened</p>
                <p className="mx-auto mt-2 max-w-[42ch] text-[0.95rem] leading-relaxed text-ink-2">
                  I&rsquo;ll turn it into a transaction — you check it before it&rsquo;s saved. You
                  can also ask me anything about your money, or send a statement with the clip.
                </p>

                {accounts.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-2">
                    Add an account from the menu first, so I have somewhere to put it.
                  </p>
                ) : (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {OPENERS.map((opener) => (
                      <button
                        key={opener}
                        type="button"
                        data-testid="chat-opener"
                        onClick={() => {
                          setInput(opener.toLowerCase());
                          inputRef.current?.focus();
                        }}
                        className="rounded-full border-2 border-navy/25 px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-navy hover:text-navy"
                      >
                        {opener}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      data-testid={`chat-msg-${m.role}`}
                      className={`bubble-in max-w-[85%] rounded-2xl border-3 border-navy px-4 py-2.5 leading-relaxed ${
                        m.role === "user" ? "whitespace-pre-wrap" : "text-[0.97rem]"
                      }`}
                      style={{
                        backgroundColor:
                          m.role === "user" ? "var(--gus-cyan)" : "var(--gus-cream)",
                        borderWidth: 3,
                      }}
                    >
                      {m.role === "assistant" ? (
                        // Replies arrive as markdown. The user's own words are
                        // shown exactly as typed, never reinterpreted.
                        m.content ? (
                          <Markdown text={m.content} />
                        ) : (
                          "…"
                        )
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}

                {pending && (
                  <div ref={pendingRef} className="flex scroll-mt-2 flex-col gap-3">
                    <div className="flex justify-end">
                      <div
                        data-testid="chat-msg-user"
                        className="max-w-[85%] whitespace-pre-wrap rounded-2xl border-3 border-navy px-4 py-2.5 leading-relaxed"
                        style={{ backgroundColor: "var(--gus-cyan)", borderWidth: 3 }}
                      >
                        {pending.userText}
                      </div>
                    </div>

                    {pending.proposals.length > 1 && (
                      <p className="text-center text-xs text-ink-2" data-testid="queue-progress">
                        {pending.index + 1} of {pending.proposals.length}
                      </p>
                    )}

                    <div className="flex justify-start">
                      <ActionCard
                        key={pending.index}
                        action={pending.proposals[pending.index].action}
                        values={pending.proposals[pending.index].values}
                        context={{ accounts, categories, currency, today }}
                        saving={savingDraft}
                        error={draftError}
                        onChange={(next) =>
                          setPending((prev) => {
                            if (!prev) return prev;
                            const proposals = prev.proposals.slice();
                            proposals[prev.index] = {
                              ...proposals[prev.index],
                              values: next,
                            };
                            return { ...prev, proposals };
                          })
                        }
                        onSave={confirmAction}
                        onCancel={skipAction}
                      />
                    </div>
                  </div>
                )}

                {busy && (
                  <div className="flex justify-start">
                    <div
                      data-testid="chat-busy"
                      className="bubble-in flex items-center gap-2 rounded-2xl border-3 border-navy px-4 py-2.5 text-ink-2"
                      style={{ backgroundColor: "var(--gus-cream)", borderWidth: 3 }}
                    >
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="ml-1 text-sm">
                        {busy === "undo" ? "Putting that back" : "Reading your statement"}
                      </span>
                    </div>
                  </div>
                )}

                {lastLog && !busy && (
                  <div className="flex justify-start">
                    <button
                      data-testid="undo-log-btn"
                      onClick={undoLastLog}
                      className="flex items-center gap-1.5 rounded-full border-2 border-navy/25 px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-navy hover:text-navy"
                    >
                      <Icon name="undo" size={16} />
                      Undo that
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div
            data-testid="chat-error"
            className="mb-2 shrink-0 rounded-2xl px-4 py-2 text-sm text-white"
            style={{ backgroundColor: "var(--gus-orange)" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={send} className="flex shrink-0 items-center gap-2">
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
            className="chunky-btn flex shrink-0 items-center justify-center bg-white text-navy"
            style={{ height: 52, width: 52, borderRadius: 999 }}
          >
            <Icon name="paperclip" />
          </button>
          <input
            ref={inputRef}
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={pending ? "Check the card above first" : "Spent 12 on lunch…"}
            disabled={!!pending || busy !== null}
            aria-label="Message Money Buddy"
            className="chunky-field min-w-0 flex-1"
            style={{ height: 52, borderRadius: 999, paddingInline: "1.1rem" }}
          />
          <button
            data-testid="chat-send-btn"
            type="submit"
            aria-label="Send"
            disabled={locked || !input.trim()}
            className="chunky-btn flex shrink-0 items-center justify-center text-navy"
            style={{
              height: 52,
              width: 52,
              borderRadius: 999,
              backgroundColor: "var(--gus-lime)",
            }}
          >
            <Icon name="send" />
          </button>
        </form>
      </div>
    </div>
  );
}
