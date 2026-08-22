"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Budget, BudgetPeriod, Category } from "@/lib/types";
import { getCurrencySymbol } from "@/lib/currency";
import BudgetJar from "@/components/BudgetJar";
import AppHeader from "@/components/AppHeader";
import PageShell from "@/components/PageShell";

const PERIODS: { value: BudgetPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export default function BudgetsClient({ currency }: { currency: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("month");

  function refreshBudgets() {
    fetch("/api/budgets")
      .then((res) => res.json())
      .then((data) => setBudgets(data.budgets ?? []));
  }

  useEffect(() => {
    refreshBudgets();
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  async function addBudget(e: React.FormEvent) {
    e.preventDefault();
    const limit = parseFloat(limitAmount);
    if (!categoryId || !(limit > 0)) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, limitAmount: limit, period }),
    });
    // Setting a budget for a category that already has one updates it rather
    // than adding a second limit, so refetch instead of appending: the real
    // spend-so-far for the (possibly new) period only exists server-side.
    refreshBudgets();
    setCategoryId("");
    setLimitAmount("");
    setPeriod("month");
  }

  async function deleteBudget(id: string) {
    await fetch(`/api/budgets?id=${id}`, { method: "DELETE" });
    setBudgets((prev) => (prev ?? []).filter((b) => b.id !== id));
  }

  return (
    <PageShell>
      <AppHeader title="BUDGETS" onLogout={handleLogout} />

      {!budgets ? (
        <p className="font-display text-sm text-navy/60 text-center">Loading...</p>
      ) : budgets.length === 0 ? (
        <p className="font-display text-sm text-navy/60 text-center mb-4">
          No budgets yet — set a limit for a category below.
        </p>
      ) : (
        budgets.map((b) => (
          <BudgetJar
            key={b.id}
            budget={b}
            category={categoryById.get(b.categoryId)}
            currency={currency}
            onDelete={deleteBudget}
          />
        ))
      )}

      <div
        data-testid="add-budget-card"
        className="chunky-card p-5 sm:p-6 mt-3"
        style={{ backgroundColor: "var(--gus-yellow)" }}
      >
        <h2 className="font-display text-xl text-navy mb-3">SET A BUDGET</h2>
        {categories.length === 0 ? (
          <p className="font-display text-sm text-navy/70">
            Add a category first (Menu → Categories) before setting a budget.
          </p>
        ) : (
          <form className="space-y-3" onSubmit={addBudget}>
            <select
              data-testid="budget-category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            >
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  data-testid={`period-option-${p.value}`}
                  onClick={() => setPeriod(p.value)}
                  aria-pressed={period === p.value}
                  className="font-display flex-1 rounded-2xl border-3 border-navy py-2 text-sm uppercase tracking-wide"
                  style={{
                    borderWidth: 3,
                    backgroundColor: period === p.value ? "var(--gus-navy)" : "white",
                    color: period === p.value ? "#fff" : "var(--gus-navy)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl text-navy pointer-events-none">
                {getCurrencySymbol(currency)}
              </span>
              <input
                data-testid="budget-limit-input"
                inputMode="decimal"
                type="number"
                min={0}
                step="0.01"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder={`Limit per ${period}`}
                className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy pl-9 pr-4 py-3 outline-none bg-white"
                style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
              />
            </div>
            <button
              data-testid="add-budget-btn"
              type="submit"
              disabled={!categoryId || !limitAmount}
              className="chunky-btn w-full py-3 text-lg text-white"
              style={{ backgroundColor: "var(--gus-pink)" }}
            >
              + ADD BUDGET
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
