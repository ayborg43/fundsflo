"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccountSummary, Bill, BillRecurrence, Category } from "@/lib/types";
import { daysUntilDue } from "@/lib/due";
import { formatMoney } from "@/lib/format";
import { getCurrencySymbol } from "@/lib/currency";
import AppHeader from "@/components/AppHeader";
import PageShell from "@/components/PageShell";

// A monthly bill is "paid" for the current cycle; a one-off is paid forever
// once it's paid, since there is no next cycle for it to reset on.
function isPaid(bill: Bill): boolean {
  if (!bill.lastPaidAt) return false;
  if (bill.recurrence === "once") return true;
  const paid = new Date(bill.lastPaidAt);
  const now = new Date();
  return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
}

function dueLabel(bill: Bill): string {
  const days = daysUntilDue(bill);
  if (days === null) return "no date set";
  if (days < 0) return `Overdue by ${-days}d`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
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
  const [recurrence, setRecurrence] = useState<BillRecurrence>("monthly");
  const [dueDay, setDueDay] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [remindDaysBefore, setRemindDaysBefore] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    fetch("/api/bills").then((r) => r.json()).then((d) => setBills(d.bills ?? []));
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
  }, []);

  const sortedBills = (bills ?? []).slice().sort((a, b) => (daysUntilDue(a) ?? 9999) - (daysUntilDue(b) ?? 9999));

  async function addBill(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || !(amt > 0)) return;
    if (recurrence === "monthly") {
      const day = parseInt(dueDay, 10);
      if (day < 1 || day > 28) return;
    } else if (!dueDate) {
      return;
    }
    const remind = parseInt(remindDaysBefore, 10);

    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        amount: amt,
        recurrence,
        dueDayOfMonth: recurrence === "monthly" ? parseInt(dueDay, 10) : undefined,
        dueDate: recurrence === "once" ? dueDate : undefined,
        remindDaysBefore: Number.isFinite(remind) && remind > 0 ? remind : undefined,
        accountId: accountId || null,
        categoryId: categoryId || null,
      }),
    });
    const data = await res.json();
    setBills((prev) => [...(prev ?? []), data.bill]);
    setName("");
    setAmount("");
    setDueDay("1");
    setDueDate("");
    setRemindDaysBefore("");
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
    <PageShell>
      <AppHeader title="BILLS" onLogout={handleLogout} />

      {!bills ? (
        <p className="font-display text-sm text-navy/60 text-center">Loading...</p>
      ) : sortedBills.length === 0 ? (
        <p className="font-display text-sm text-navy/60 text-center mb-4">
          No bills yet — add one below.
        </p>
      ) : (
        sortedBills.map((bill) => {
          const paid = isPaid(bill);
          return (
            <div
              key={bill.id}
              data-testid={`bill-${bill.id}`}
              className="chunky-card p-4 sm:p-5 mb-3 flex items-center justify-between gap-3"
              style={{ backgroundColor: paid ? "#e8ffd8" : "white" }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg text-navy flex items-center gap-1.5">
                  {/* A text pill here overflowed on a phone once "Mark paid"
                      and delete were also in the row -- an icon with a
                      tooltip carries the same information in far less width,
                      matching the reminder bell below. */}
                  <span className="truncate min-w-0">{bill.name}</span>
                  {bill.recurrence === "once" && (
                    <span
                      data-testid={`bill-once-${bill.id}`}
                      title="One-time payment, not recurring"
                      className="text-sm shrink-0"
                    >
                      📌
                    </span>
                  )}
                  {!!bill.remindDaysBefore && (
                    <span
                      data-testid={`bill-reminder-${bill.id}`}
                      title={`Reminds ${bill.remindDaysBefore} day${bill.remindDaysBefore === 1 ? "" : "s"} before`}
                      className="text-sm shrink-0"
                    >
                      🔔
                    </span>
                  )}
                </div>
                <div className="font-display text-sm text-navy/70">
                  {formatMoney(bill.amount, currency)} ·{" "}
                  {paid
                    ? bill.recurrence === "once"
                      ? "Paid ✓"
                      : "Paid this month ✓"
                    : dueLabel(bill)}
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
          <div className="flex gap-2">
            {(
              [
                ["monthly", "Every month"],
                ["once", "Just once"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`bill-recurrence-${value}`}
                onClick={() => setRecurrence(value)}
                aria-pressed={recurrence === value}
                className="font-display flex-1 rounded-2xl border-3 border-navy py-2 text-sm uppercase tracking-wide"
                style={{
                  borderWidth: 3,
                  backgroundColor: recurrence === value ? "var(--gus-navy)" : "white",
                  color: recurrence === value ? "#fff" : "var(--gus-navy)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

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
            {recurrence === "monthly" ? (
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
            ) : (
              <input
                data-testid="bill-due-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="chunky-field chunky-field--date w-40 text-sm"
              />
            )}
          </div>
          <input
            data-testid="bill-remind-input"
            type="number"
            min={0}
            max={30}
            value={remindDaysBefore}
            onChange={(e) => setRemindDaysBefore(e.target.value)}
            placeholder="Remind me this many days before (optional)"
            className="w-full font-display text-base text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
            style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
          />
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
            disabled={!name.trim() || !amount || (recurrence === "once" && !dueDate)}
            className="chunky-btn w-full py-3 text-lg text-white"
            style={{ backgroundColor: "var(--gus-pink)" }}
          >
            + ADD BILL
          </button>
        </form>
      </div>
    </PageShell>
  );
}
