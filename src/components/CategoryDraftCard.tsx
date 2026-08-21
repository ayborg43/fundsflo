"use client";

import Icon from "@/components/Icon";
import type { CategoryDraft } from "@/lib/types";

// Same confirm-before-write contract as TransactionDraftCard, and the same
// bubble treatment so both read as one voice inside the thread.
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
      className="bubble-in w-[92%] overflow-hidden rounded-2xl border-3 border-navy"
      style={{ borderWidth: 3, backgroundColor: "#fff" }}
    >
      <div
        className="border-b-3 border-navy px-4 py-3"
        style={{ backgroundColor: "var(--gus-yellow)", borderBottomWidth: 3 }}
      >
        <span className="font-display text-sm uppercase tracking-[0.12em] text-navy">
          New category
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <label className="block w-20 shrink-0">
            <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
              Emoji
            </span>
            <input
              data-testid="category-draft-emoji"
              value={draft.emoji}
              onChange={(e) =>
                onChange({ ...draft, emoji: [...e.target.value].slice(0, 4).join("") })
              }
              disabled={saving}
              aria-label="Category emoji"
              className="chunky-field text-center text-2xl"
            />
          </label>
          <label className="block min-w-0 flex-1">
            <span className="font-display mb-1 block text-xs uppercase tracking-[0.1em] text-ink-2">
              Name
            </span>
            <input
              data-testid="category-draft-name"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              maxLength={40}
              placeholder="e.g. Pets"
              disabled={saving}
              aria-label="Category name"
              className="chunky-field text-lg"
            />
          </label>
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

        <div className="flex gap-2 pt-1">
          <button
            data-testid="category-draft-save-btn"
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            className="chunky-btn font-display flex flex-1 items-center justify-center gap-2 py-2.5 text-navy"
            style={{ backgroundColor: "var(--gus-lime)", borderRadius: 999 }}
          >
            {saving ? "Saving…" : <><Icon name="check" size={18} /> Add it</>}
          </button>
          <button
            data-testid="category-draft-cancel-btn"
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
