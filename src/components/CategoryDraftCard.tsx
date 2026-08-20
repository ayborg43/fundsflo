"use client";

import type { CategoryDraft } from "@/lib/types";

// Same confirm-before-write contract as TransactionDraftCard: the AI proposes
// a name and emoji, the user can fix either, and nothing is created until
// they say so.
export default function CategoryDraftCard({
  draft,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: CategoryDraft;
  saving: boolean;
  error: string | null;
  onChange: (next: CategoryDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-testid="category-draft-card"
      className="chunky-card p-4 sm:p-5 max-w-[92%]"
      style={{ backgroundColor: "var(--gus-cream)" }}
    >
      <p className="font-display text-lg text-navy mb-3">New category?</p>

      <div className="flex gap-2 mb-3">
        <input
          data-testid="category-draft-emoji"
          value={draft.emoji}
          onChange={(e) => onChange({ ...draft, emoji: [...e.target.value].slice(0, 4).join("") })}
          disabled={saving}
          aria-label="Emoji"
          className="w-16 text-center font-display text-2xl text-navy rounded-2xl border-3 border-navy px-2 py-2 bg-white outline-none"
          style={{ borderWidth: 3 }}
        />
        <input
          data-testid="category-draft-name"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          maxLength={40}
          placeholder="e.g. Pets"
          disabled={saving}
          aria-label="Category name"
          className="flex-1 min-w-0 font-display text-lg text-navy rounded-2xl border-3 border-navy px-3 py-2 bg-white outline-none"
          style={{ borderWidth: 3 }}
        />
      </div>

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
          data-testid="category-draft-save-btn"
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="flex-1 chunky-btn py-3 text-lg text-navy"
          style={{ backgroundColor: "var(--gus-lime)" }}
        >
          {saving ? "Saving…" : "Add it"}
        </button>
        <button
          data-testid="category-draft-cancel-btn"
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
