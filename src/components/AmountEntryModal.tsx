"use client";

import { useState } from "react";
import type { Category, TransactionType } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const TAGS = ["cash", "bank"] as const;

export default function AmountEntryModal({
  type,
  currency,
  categories,
  onClose,
  onConfirm,
}: {
  type: TransactionType;
  currency: string;
  categories: Category[];
  onClose: () => void;
  onConfirm: (
    amount: number,
    description: string,
    tag: string | null,
    categoryId: string | null
  ) => void;
}) {
  const [digits, setDigits] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const amount = digits ? parseFloat(digits) || 0 : 0;
  const isMake = type === "make";

  function pressDigit(d: string) {
    setDigits((prev) => {
      if (d === "." && prev.includes(".")) return prev;
      if (prev.includes(".") && prev.split(".")[1]?.length >= 2) return prev;
      if (prev === "0" && d !== ".") return d;
      return prev + d;
    });
  }

  function pressDelete() {
    setDigits((prev) => prev.slice(0, -1));
  }

  function submit() {
    if (amount <= 0) return;
    onConfirm(amount, description.trim(), tag, categoryId);
  }

  return (
    <div
      data-testid={`amount-entry-modal-${type}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center fade-in"
      style={{ backgroundColor: "rgba(42, 45, 124, 0.45)" }}
      onClick={onClose}
    >
      <div
        className="modal-slide-up w-full sm:max-w-md bg-white rounded-t-[36px] sm:rounded-[36px] border-4 border-navy p-5 sm:p-7 max-h-[95vh] overflow-y-auto"
        style={{ boxShadow: "var(--gus-navy) 0px -8px 0px 0px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-3xl sm:text-4xl text-navy">
            {isMake ? "MAKE MONEY!" : "SPEND MONEY!"}
          </h2>
          <button
            data-testid="close-modal-btn"
            aria-label="Close"
            onClick={onClose}
            className="w-10 h-10 rounded-full border-3 border-navy flex items-center justify-center bg-white hover:scale-105 transition-transform"
            style={{ boxShadow: "var(--gus-navy) 0px 3px 0px 0px", borderWidth: 3 }}
          >
            ✕
          </button>
        </div>
        <p className="font-display text-base text-navy/70 mb-4">
          {isMake ? "How much did you earn?" : "How much did you spend?"}
        </p>

        <div
          data-testid="amount-display"
          className="rounded-3xl border-4 border-navy p-5 mb-4 text-center font-display text-5xl sm:text-6xl text-navy break-all"
          style={{
            backgroundColor: isMake ? "var(--gus-lime)" : "var(--gus-orange)",
            boxShadow: "var(--gus-navy) 0px 4px 0px 0px",
            color: isMake ? undefined : "#fff",
          }}
        >
          {formatMoney(amount, currency)}
        </div>

        {isMake ? (
          <div className="mb-4">
            <label className="font-display text-base text-navy block mb-2">
              How did you get paid? (optional)
            </label>
            <div className="flex gap-3">
              {TAGS.map((t) => (
                <button
                  key={t}
                  data-testid={`tag-${t}`}
                  onClick={() => setTag((prev) => (prev === t ? null : t))}
                  className="flex-1 chunky-btn py-3 text-lg sm:text-xl uppercase"
                  style={{
                    backgroundColor: tag === t ? "var(--gus-yellow)" : "white",
                    opacity: tag === t ? 1 : 0.85,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="font-display text-base text-navy block mb-2">
              What&apos;s it for? (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={40}
              placeholder="e.g. food"
              className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            />
          </div>
        )}

        {categories.length > 0 && (
          <div className="mb-4">
            <label className="font-display text-base text-navy block mb-2">
              Category (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`category-chip-${c.id}`}
                  onClick={() => setCategoryId((prev) => (prev === c.id ? null : c.id))}
                  className="chunky-btn px-3 py-2 text-sm"
                  style={{
                    backgroundColor: categoryId === c.id ? "var(--gus-yellow)" : "white",
                    opacity: categoryId === c.id ? 1 : 0.85,
                  }}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map((d) => (
            <button
              key={d}
              data-testid={`numpad-${d === "." ? "dot" : d}`}
              onClick={() => pressDigit(d)}
              className="numpad-key"
            >
              {d}
            </button>
          ))}
          <button
            data-testid="numpad-del"
            aria-label="delete"
            onClick={pressDelete}
            className="numpad-key flex items-center justify-center"
          >
            ⌫
          </button>
        </div>

        <button
          data-testid="confirm-amount-btn"
          disabled={amount <= 0}
          onClick={submit}
          className="chunky-btn w-full py-4 text-2xl sm:text-3xl text-navy"
          style={{ backgroundColor: isMake ? "var(--gus-lime)" : "var(--gus-orange)" }}
        >
          ADD {formatMoney(amount, currency)}
        </button>
      </div>
    </div>
  );
}
