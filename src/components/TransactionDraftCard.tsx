"use client";

import { useState } from "react";

import Icon from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import type { AccountSummary, Category, TransactionDraft } from "@/lib/types";

// The AI's reading of a message, shown for confirmation before anything is
// written. Every field is editable, so a misparse ("12" heard as "1.20", the
// wrong account) is a correction here rather than a bad row to hunt down
// later. Save is blocked until there is an account and a positive amount.
//
// Styled as a bubble in the thread, not a card: it lives inside the
// transcript's own card, and nesting one chunky border in another read as a
// dialog that had escaped its frame.
export default function TransactionDraftCard({
  draft,
  currency,
  accounts,
  categories,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: TransactionDraft;
  currency: string;
  accounts: AccountSummary[];
  categories: Category[];
  saving: boolean;
  error: string | null;
  onChange: (next: TransactionDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isMake = draft.type === "make";
  const canSave = !saving && draft.accountId !== null && draft.amount > 0;
  // A backdated entry can't be in the future, and an empty date means "now".
  const today = new Date().toISOString().slice(0, 10);
  // Derived from `today` by arithmetic rather than a second clock read, which
  // keeps the render pure and the two dates guaranteed consecutive.
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const accent = isMake ? "var(--gus-lime)" : "var(--gus-orange)";

  // Almost every entry is today or yesterday, and a permanent date field cost
  // a whole row plus the browser's own mm/dd/yyyy chrome sitting inside a
  // hand-drawn card. Chips cover the common cases; the picker appears only
  // when someone actually needs another day.
  const [pickingDate, setPickingDate] = useState(
    draft.date !== null && draft.date !== yesterday
  );

  const dateChoice = draft.date === null ? "today" : draft.date === yesterday ? "yesterday" : "other";

  return (
    <div
      data-testid="draft-card"
      className="bubble-in w-[92%] overflow-hidden rounded-2xl border-3 border-navy"
      style={{ borderWidth: 3, backgroundColor: "#fff" }}
    >
      {/* The headline restates what was understood, so the fields below are a
          correction surface rather than a form to read top to bottom. */}
      <div
        className="flex items-baseline justify-between gap-3 border-b-3 border-navy px-4 py-3"
        style={{ backgroundColor: accent, borderBottomWidth: 3 }}
      >
        <span
          className="font-display text-sm uppercase tracking-[0.12em]"
          style={{ color: isMake ? "var(--gus-navy)" : "#fff" }}
        >
          {isMake ? "Money in" : "Money out"}
        </span>
        <span
          className="font-display tnum text-2xl"
          style={{ color: isMake ? "var(--gus-navy)" : "#fff" }}
        >
          {formatMoney(draft.amount, currency)}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          {(["spend", "make"] as const).map((option) => (
            <button
              key={option}
              data-testid={`draft-type-${option}`}
              onClick={() => onChange({ ...draft, type: option })}
              disabled={saving}
              aria-pressed={draft.type === option}
              className="font-display flex-1 rounded-full border-3 border-navy py-2 text-sm uppercase tracking-wide transition-colors"
              style={{
                borderWidth: 3,
                backgroundColor:
                  draft.type === option
                    ? option === "make"
                      ? "var(--gus-lime)"
                      : "var(--gus-orange)"
                    : "#fff",
                color: draft.type === option && option === "spend" ? "#fff" : "var(--gus-navy)",
              }}
            >
              {option === "make" ? "Made" : "Spent"}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <label className="block w-[38%] shrink-0">
            <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
              Amount
            </span>
            <input
              data-testid="draft-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={draft.amount === 0 ? "" : draft.amount}
              onChange={(e) => onChange({ ...draft, amount: Number(e.target.value) || 0 })}
              disabled={saving}
              className="chunky-field tnum font-display text-xl"
            />
          </label>

          <label className="block min-w-0 flex-1">
            <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
              What for
            </span>
            <input
              data-testid="draft-description"
              value={draft.description}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
              maxLength={80}
              placeholder={isMake ? "e.g. allowance" : "e.g. lunch"}
              disabled={saving}
              className="chunky-field"
              style={{ paddingBlock: "0.85rem" }}
            />
          </label>
        </div>

        <div>
          <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
            When
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["today", "Today", null],
                ["yesterday", "Yesterday", yesterday],
              ] as const
            ).map(([key, label, value]) => (
              <button
                key={key}
                type="button"
                data-testid={`draft-when-${key}`}
                onClick={() => {
                  setPickingDate(false);
                  onChange({ ...draft, date: value });
                }}
                disabled={saving}
                aria-pressed={dateChoice === key}
                className="rounded-full border-2 px-3 py-1.5 text-sm transition-colors"
                style={{
                  borderColor:
                    dateChoice === key ? "var(--gus-navy)" : "color-mix(in srgb, var(--gus-navy) 25%, transparent)",
                  backgroundColor: dateChoice === key ? "var(--gus-navy)" : "transparent",
                  color: dateChoice === key ? "#fff" : "var(--gus-ink-2)",
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              data-testid="draft-when-other"
              onClick={() => setPickingDate(true)}
              disabled={saving}
              aria-pressed={dateChoice === "other"}
              className="rounded-full border-2 px-3 py-1.5 text-sm transition-colors"
              style={{
                borderColor:
                  dateChoice === "other" ? "var(--gus-navy)" : "color-mix(in srgb, var(--gus-navy) 25%, transparent)",
                backgroundColor: dateChoice === "other" ? "var(--gus-navy)" : "transparent",
                color: dateChoice === "other" ? "#fff" : "var(--gus-ink-2)",
              }}
            >
              Other
            </button>
          </div>
          {pickingDate && (
            <input
              data-testid="draft-date"
              type="date"
              max={today}
              value={draft.date ?? ""}
              onChange={(e) => onChange({ ...draft, date: e.target.value || null })}
              disabled={saving}
              aria-label="Pick a date"
              className="chunky-field chunky-field--date mt-2 text-sm"
            />
          )}
        </div>

        <div className={categories.length > 0 ? "grid grid-cols-2 gap-3" : ""}>
          <label className="block min-w-0">
            <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
              {isMake ? "Into" : "From"}
            </span>
            <select
              data-testid="draft-account"
              value={draft.accountId ?? ""}
              onChange={(e) => onChange({ ...draft, accountId: e.target.value || null })}
              disabled={saving}
              className="chunky-field chunky-field--select"
            >
              <option value="">Choose…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          {categories.length > 0 && (
            <label className="block min-w-0">
              <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
                Category
              </span>
              <select
                data-testid="draft-category"
                value={draft.categoryId ?? ""}
                onChange={(e) => onChange({ ...draft, categoryId: e.target.value || null })}
                disabled={saving}
                className="chunky-field chunky-field--select"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl px-3 py-2 text-sm text-white"
            style={{ backgroundColor: "var(--gus-orange)" }}
          >
            {error}
          </p>
        )}

        {!canSave && !saving && draft.accountId === null && (
          <p className="text-sm text-ink-2">Pick an account and I&rsquo;ll save it.</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            data-testid="draft-save-btn"
            onClick={onSave}
            disabled={!canSave}
            className="chunky-btn font-display flex flex-1 items-center justify-center gap-2 py-2.5 text-navy"
            style={{ backgroundColor: "var(--gus-lime)", borderRadius: 999 }}
          >
            {saving ? "Saving…" : <><Icon name="check" size={18} /> Save it</>}
          </button>
          <button
            data-testid="draft-cancel-btn"
            onClick={onCancel}
            disabled={saving}
            className="chunky-btn font-display px-4 py-2.5 text-navy"
            style={{ backgroundColor: "#fff", borderRadius: 999 }}
          >
            Nope
          </button>
        </div>
      </div>
    </div>
  );
}
