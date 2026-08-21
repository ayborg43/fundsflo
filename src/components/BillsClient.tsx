"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccountSummary, Bill, Category } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { getCurrencySymbol } from "@/lib/currency";
import AppHeader from "@/components/AppHeader";

function daysUntilDue(dueDayOfMonth: number): number {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), dueDayOfMonth);
  if (due < now) due.setMonth(due.getMonth() + 1);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function paidThisCycle(lastPaidAt: string | null): boolean {
  if (!lastPaidAt) return false;
  const paid = new Date(lastPaidAt);
  const now = new Date();
  return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
}

export default function BillsClient({ currency }: { currency: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const [bills, setBills] = useState<Bill[] | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    fetch("/api/bills").then((r) => r.json()).then((d) => setBills(d.bills ?? []));
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
  }, []);

  const sortedBills = (bills ?? []).slice().sort((a, b) => daysUntilDue(a.dueDayOfMonth) - daysUntilDue(b.dueDayOfMonth));

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    const day = parseInt(dueDay, 10);
    if (!name.trim() || !(amt > 0) || day < 1 || day > 28) return;
    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        amount: amt,
        dueDayOfMonth: day,
        accountId: accountId || null,
        categoryId: categoryId || null,
      }),
    });
    const data = await res.json();
    setBills((prev) => [...(prev ?? []), data.bill]);
    setName("");
    setAmount("");
    setDueDay("1");
  }

  async function deleteBill(id: string) {
    await fetch(`/api/bills?id=${id}`, { method: "DELETE" });
    setBills((prev) => (prev ?? []).filter((b) => b.id !== id));
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/bills/${id}/pay`, { method: "POST" });
    const data = await res.json();
    setBills((prev) => (prev ?? []).map((b) => (b.id === id ? data.bill : b)));
  }

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
      <AppHeader title="BILLS" onLogout={handleLogout} />

      {!bills ? (
        <p className="font-display text-sm text-navy/60 text-center">Loading...</p>
      ) : sortedBills.length === 0 ? (
        <p className="font-display text-sm text-navy/60 text-center mb-4">
          No recurring bills yet — add one below.
        </p>
      ) : (
        sortedBills.map((bill) => {
          const paid = paidThisCycle(bill.lastPaidAt);
          const days = daysUntilDue(bill.dueDayOfMonth);
          return (
            <div
              key={bill.id}
              data-testid={`bill-${bill.id}`}
              className="chunky-card p-4 sm:p-5 mb-3 flex items-center justify-between gap-3"
              style={{ backgroundColor: paid ? "#e8ffd8" : "white" }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg text-navy truncate">{bill.name}</div>
                <div className="font-display text-sm text-navy/70">
                  {formatMoney(bill.amount, currency)} · {paid ? "Paid this month ✓" : `Due in ${days}d`}
                </div>
              </div>
              {!paid && (
                <button
                  data-testid={`pay-bill-${bill.id}`}
                  onClick={() => markPaid(bill.id)}
                  className="chunky-btn px-3 py-2 text-sm text-navy"
                  style={{ backgroundColor: "var(--gus-lime)" }}
                >
                  Mark paid
                </button>
              )}
              <button
                data-testid={`delete-bill-${bill.id}`}
                aria-label={`Delete ${bill.name}`}
                onClick={() => deleteBill(bill.id)}
                className="w-8 h-8 rounded-full border-2 border-navy flex items-center justify-center text-sm shrink-0"
              >
                ✕
              </button>
            </div>
          );
        })
      )}

      <div
        data-testid="add-bill-card"
        className="chunky-card p-5 sm:p-6 mt-3"
        style={{ backgroundColor: "var(--gus-yellow)" }}
      >
        <h2 className="font-display text-xl text-navy mb-3">ADD A BILL</h2>
        <form className="space-y-3" onSubmit={addBill}>
          <input
            data-testid="bill-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Netflix"
            className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
            style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
          />
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl text-navy pointer-events-none">
                {getCurrencySymbol(currency)}
              </span>
              <input
                data-testid="bill-amount-input"
                inputMode="decimal"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full font-display text-lg text-navy rounded-2xl border-4 border-navy pl-9 pr-4 py-3 outline-none bg-white"
                style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
              />
            </div>
            <input
              data-testid="bill-due-day-input"
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="Due day"
              className="w-24 font-display text-lg text-navy rounded-2xl border-4 border-navy px-3 py-3 outline-none bg-white text-center"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            />
          </div>
          {accounts.length > 0 && (
            <select
              data-testid="bill-account-select"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full font-display text-base text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            >
              <option value="">Pay from... (optional)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {categories.length > 0 && (
            <select
              data-testid="bill-category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full font-display text-base text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            >
              <option value="">Category (optional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            data-testid="add-bill-btn"
            type="submit"
            disabled={!name.trim() || !amount}
            className="chunky-btn w-full py-3 text-lg text-white"
            style={{ backgroundColor: "var(--gus-pink)" }}
          >
            + ADD BILL
          </button>
        </form>
      </div>
    </div>
  );
}
