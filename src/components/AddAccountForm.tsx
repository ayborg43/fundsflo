"use client";

import { useState } from "react";
import type { AccountType } from "@/lib/types";
import { getCurrencySymbol } from "@/lib/currency";

const TYPE_OPTIONS: { value: AccountType; label: string; emoji: string }[] = [
  { value: "cash", label: "Cash", emoji: "💵" },
  { value: "checking", label: "Checking", emoji: "🏦" },
  { value: "savings", label: "Savings", emoji: "🐷" },
  { value: "credit", label: "Credit Card", emoji: "💳" },
  { value: "debt", label: "Debt / Loan", emoji: "👹" },
  { value: "investment", label: "Investment", emoji: "🌳" },
];

export default function AddAccountForm({
  currency,
  onAdd,
}: {
  currency: string;
  onAdd: (name: string, type: AccountType, startingBalance: number | null) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [startingBalance, setStartingBalance] = useState("");

  const isDebt = type === "debt";
  const parsedStarting = parseFloat(startingBalance);
  const canSubmit =
    name.trim().length > 0 && (!isDebt || (!Number.isNaN(parsedStarting) && parsedStarting > 0));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd(name.trim(), type, isDebt ? parsedStarting : null);
    setName("");
    setStartingBalance("");
  }

  return (
    <div
      data-testid="add-account-form-card"
      className="chunky-card p-5 sm:p-6 mt-5"
      style={{ backgroundColor: "var(--gus-yellow)" }}
    >
      <h2 className="font-display text-2xl sm:text-3xl text-navy mb-4">ADD AN ACCOUNT</h2>
      <form className="space-y-3" onSubmit={submit}>
        <input
          data-testid="account-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="e.g. Chase Checking"
          className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
          style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
        />

        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-testid={`account-type-${opt.value}`}
              onClick={() => setType(opt.value)}
              className="chunky-btn py-2 text-sm flex flex-col items-center gap-1"
              style={{ backgroundColor: type === opt.value ? "var(--gus-lime)" : "white" }}
            >
              <span className="text-xl">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {isDebt && (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl text-navy pointer-events-none">
              {getCurrencySymbol(currency)}
            </span>
            <input
              data-testid="account-starting-balance-input"
              inputMode="decimal"
              type="number"
              min={0}
              step="0.01"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="How much do you currently owe?"
              className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy pl-9 pr-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            />
          </div>
        )}

        <button
          data-testid="add-account-btn"
          type="submit"
          disabled={!canSubmit}
          className="chunky-btn w-full py-3 text-xl text-navy"
          style={{ backgroundColor: "var(--gus-pink)", color: "white" }}
        >
          + ADD ACCOUNT
        </button>
      </form>
    </div>
  );
}
