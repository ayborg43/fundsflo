"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountSummary, AccountType } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import AppHeader from "@/components/AppHeader";
import AccountCard from "@/components/AccountCard";
import AddAccountForm from "@/components/AddAccountForm";
import PageShell from "@/components/PageShell";

export default function HomeClient({ email, currency }: { email: string; currency: string }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts));
  }, []);

  async function handleAddAccount(name: string, type: AccountType, startingBalance: number | null) {
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, startingBalance }),
    });
    const data = await res.json();
    setAccounts((prev) => [...(prev ?? []), data.account]);
  }

  async function handleDeleteAccount(id: string) {
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    setAccounts((prev) => (prev ?? []).filter((a) => a.id !== id));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!accounts) {
    return (
      <PageShell className="text-center">
        <div className="font-display text-2xl text-navy">Loading…</div>
      </PageShell>
    );
  }

  // Debt-account balances are stored negative (owed amount), so a plain sum
  // across all accounts already nets debts against assets correctly.
  const totalNetWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <PageShell>
      <div data-testid="fundsflow-app">
        <AppHeader title="ACCOUNTS" email={email} onLogout={handleLogout} />

      <div
        data-testid="net-worth-line"
        className="mb-4 flex items-baseline justify-between px-1"
      >
        <span className="font-display text-xs uppercase tracking-[0.14em] text-ink-2">
          Net worth
        </span>
        <span
          className="font-display tnum text-2xl"
          style={{ color: totalNetWorth < 0 ? "var(--gus-orange)" : "var(--gus-navy)" }}
        >
          {formatMoney(totalNetWorth, currency)}
        </span>
      </div>

      {accounts.length === 0 ? (
        <div
          className="chunky-card p-5 sm:p-6 text-center mb-5"
          style={{ backgroundColor: "var(--gus-cream)" }}
        >
          <p className="font-display text-lg text-navy">No accounts yet — add your first one below!</p>
        </div>
      ) : (
        accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            currency={currency}
            onDelete={handleDeleteAccount}
          />
        ))
      )}

      <AddAccountForm currency={currency} onAdd={handleAddAccount} />

        <div className="text-center font-display text-sm text-navy/60 mt-6">keep stacking 💰</div>
      </div>
    </PageShell>
  );
}
