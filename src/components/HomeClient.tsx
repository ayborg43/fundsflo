"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountSummary, AccountType } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import AppHeader from "@/components/AppHeader";
import AccountCard from "@/components/AccountCard";
import AddAccountForm from "@/components/AddAccountForm";

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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 text-center">
        <div className="font-display text-2xl text-navy">Loading...</div>
      </div>
    );
  }

  // Debt-account balances are stored negative (owed amount), so a plain sum
  // across all accounts already nets debts against assets correctly.
  const totalNetWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div data-testid="fundsflow-app" className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
      <AppHeader title="FUNDSFLOW" onLogout={handleLogout} />

      <p className="font-display text-sm text-navy/60 text-center -mt-4 mb-4 truncate">
        {email}
      </p>

      <div
        data-testid="net-worth-line"
        className="flex items-center justify-between font-display text-navy mb-4 px-1"
      >
        <span className="text-sm text-navy/60 uppercase tracking-wide">Net worth</span>
        <span className="text-2xl">{formatMoney(totalNetWorth, currency)}</span>
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
  );
}
