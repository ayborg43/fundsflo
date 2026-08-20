"use client";

import { formatMoney } from "@/lib/format";
import type { AccountSummary, Category, TransactionDraft } from "@/lib/types";

// The AI's reading of a message, shown for confirmation before anything is
// written. Every field is editable, so a misparse ("12" heard as "1.20", the
// wrong account) is a correction here rather than a bad row to hunt down
// later. Save is blocked until there is an account and a positive amount.
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

  return (
    <div
      data-testid="draft-card"
      className="chunky-card p-4 sm:p-5 max-w-[92%]"
      style={{ backgroundColor: "var(--gus-cream)" }}
    >
      <div className="flex gap-2 mb-3">
        {(["spend", "make"] as const).map((option) => (
          <button
            key={option}
            data-testid={`draft-type-${option}`}
            onClick={() => onChange({ ...draft, type: option })}
            disabled={saving}
            className="flex-1 chunky-btn py-2 text-sm uppercase text-navy"
            style={{
              backgroundColor:
                draft.type === option
                  ? option === "make"
                    ? "var(--gus-lime)"
                    : "var(--gus-orange)"
                  : "white",
              color: draft.type === option && option === "spend" ? "#fff" : undefined,
            }}
          >
            {option === "make" ? "🤑 Made" : "💸 Spent"}
          </button>
        ))}
      </div>

      <label className="font-display text-sm text-navy/70 block mb-1">
        Amount ({formatMoney(draft.amount, currency)})
      </label>
      <input
        data-testid="draft-amount"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={draft.amount === 0 ? "" : draft.amount}
        onChange={(e) => onChange({ ...draft, amount: Number(e.target.value) || 0 })}
        disabled={saving}
        className="w-full font-display text-2xl text-navy rounded-2xl border-3 border-navy px-3 py-2 mb-3 bg-white outline-none"
        style={{ borderWidth: 3 }}
      />

      <label className="font-display text-sm text-navy/70 block mb-1">What for?</label>
      <input
        data-testid="draft-description"
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        maxLength={80}
        placeholder={isMake ? "e.g. allowance" : "e.g. lunch"}
        disabled={saving}
        className="w-full font-display text-lg text-navy rounded-2xl border-3 border-navy px-3 py-2 mb-3 bg-white outline-none"
        style={{ borderWidth: 3 }}
      />

      <label className="font-display text-sm text-navy/70 block mb-1">
        {isMake ? "Into" : "From"}
      </label>
      <select
        data-testid="draft-account"
        value={draft.accountId ?? ""}
        onChange={(e) => onChange({ ...draft, accountId: e.target.value || null })}
        disabled={saving}
        className="w-full font-display text-lg text-navy rounded-2xl border-3 border-navy px-3 py-2 mb-3 bg-white outline-none"
        style={{ borderWidth: 3 }}
      >
        <option value="">Pick an account…</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <label className="font-display text-sm text-navy/70 block mb-1">When</label>
      <input
        data-testid="draft-date"
        type="date"
        max={today}
        value={draft.date ?? ""}
        onChange={(e) => onChange({ ...draft, date: e.target.value || null })}
        disabled={saving}
        className="w-full font-display text-lg text-navy rounded-2xl border-3 border-navy px-3 py-2 mb-1 bg-white outline-none"
        style={{ borderWidth: 3 }}
      />
      <p className="font-display text-xs text-navy/50 mb-3">
        {draft.date ? "Backdated." : "Leave empty for right now."}
      </p>

      {categories.length > 0 && (
        <>
          <label className="font-display text-sm text-navy/70 block mb-1">Category</label>
          <select
            data-testid="draft-category"
            value={draft.categoryId ?? ""}
            onChange={(e) => onChange({ ...draft, categoryId: e.target.value || null })}
            disabled={saving}
            className="w-full font-display text-lg text-navy rounded-2xl border-3 border-navy px-3 py-2 mb-3 bg-white outline-none"
            style={{ borderWidth: 3 }}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </>
      )}

      {error && (
        <p
          className="font-display text-sm text-white rounded-2xl px-3 py-2 mb-3"
          style={{ backgroundColor: "var(--gus-orange)" }}
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          data-testid="draft-save-btn"
          onClick={onSave}
          disabled={!canSave}
          className="flex-1 chunky-btn py-3 text-lg text-navy"
          style={{ backgroundColor: "var(--gus-lime)" }}
        >
          {saving ? "Saving…" : "Save it"}
        </button>
        <button
          data-testid="draft-cancel-btn"
          onClick={onCancel}
          disabled={saving}
          className="chunky-btn py-3 px-4 text-lg text-navy"
          style={{ backgroundColor: "white" }}
        >
          Nope
        </button>
      </div>
    </div>
  );
}
