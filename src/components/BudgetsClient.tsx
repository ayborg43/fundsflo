"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Budget, Category } from "@/lib/types";
import { getCurrencySymbol } from "@/lib/currency";
import BudgetJar from "@/components/BudgetJar";
import AppHeader from "@/components/AppHeader";

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
  const [monthlyLimit, setMonthlyLimit] = useState("");

  useEffect(() => {
    fetch("/api/budgets")
      .then((res) => res.json())
      .then((data) => setBudgets(data.budgets ?? []));
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  async function addBudget(e: React.FormEvent) {
    e.preventDefault();
    const limit = parseFloat(monthlyLimit);
    if (!categoryId || !(limit > 0)) return;
    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, monthlyLimit: limit }),
    });
    const data = await res.json();
    setBudgets((prev) => [...(prev ?? []), data.budget]);
    setCategoryId("");
    setMonthlyLimit("");
  }

  async function deleteBudget(id: string) {
    await fetch(`/api/budgets?id=${id}`, { method: "DELETE" });
    setBudgets((prev) => (prev ?? []).filter((b) => b.id !== id));
  }

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
      <AppHeader title="BUDGETS" onLogout={handleLogout} />

      {!budgets ? (
        <p className="font-display text-sm text-navy/60 text-center">Loading...</p>
      ) : budgets.length === 0 ? (
        <p className="font-display text-sm text-navy/60 text-center mb-4">
          No budgets yet — set a monthly limit for a category below.
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
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="Monthly limit"
                className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy pl-9 pr-4 py-3 outline-none bg-white"
                style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
              />
            </div>
            <button
              data-testid="add-budget-btn"
              type="submit"
              disabled={!categoryId || !monthlyLimit}
              className="chunky-btn w-full py-3 text-lg text-white"
              style={{ backgroundColor: "var(--gus-pink)" }}
            >
              + ADD BUDGET
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
