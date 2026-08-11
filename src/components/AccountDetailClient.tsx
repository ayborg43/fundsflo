"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountDetail, Category, TransactionType } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import BalanceCard from "@/components/BalanceCard";
import DebtMonster from "@/components/DebtMonster";
import MoneyButtons from "@/components/MoneyButtons";
import AmountEntryModal from "@/components/AmountEntryModal";
import GoalTimeline from "@/components/GoalTimeline";
import AddGoalForm from "@/components/AddGoalForm";
import TransactionFeed from "@/components/TransactionFeed";
import Confetti, { makeConfettiPieces } from "@/components/Confetti";

export default function AccountDetailClient({
  accountId,
  currency,
}: {
  accountId: string;
  currency: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalType, setModalType] = useState<TransactionType | null>(null);
  const [confettiPieces, setConfettiPieces] = useState<ReturnType<typeof makeConfettiPieces>>([]);

  useEffect(() => {
    fetch(`/api/accounts/${accountId}`)
      .then((res) => res.json())
      .then((data) => setAccount(data.account));
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, [accountId]);

  function celebrate() {
    setConfettiPieces(makeConfettiPieces());
    setTimeout(() => setConfettiPieces([]), 2800);
  }

  function celebrateIfGoalsReached(prevBalance: number, next: AccountDetail) {
    const newlyReached = next.goals.some(
      (g) => g.price > prevBalance && g.price <= next.balance
    );
    if (newlyReached) celebrate();
  }

  function celebrateIfDebtPaidOff(prevBalance: number, next: AccountDetail) {
    if (next.type !== "debt") return;
    const wasOwed = -prevBalance > 0;
    const nowOwed = -next.balance > 0;
    if (wasOwed && !nowOwed) celebrate();
  }

  async function handleConfirmTransaction(
    amount: number,
    description: string,
    tag: string | null,
    categoryId: string | null
  ) {
    if (!modalType || !account) return;
    const prevBalance = account.balance;
    const res = await fetch(`/api/accounts/${accountId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: modalType, amount, description, tag, categoryId }),
    });
    const data = await res.json();
    setAccount(data.account);
    setModalType(null);
    celebrateIfGoalsReached(prevBalance, data.account);
    celebrateIfDebtPaidOff(prevBalance, data.account);
  }

  async function handleDeleteTransaction(id: string) {
    const res = await fetch(`/api/accounts/${accountId}/transactions?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setAccount(data.account);
  }

  async function handleAddGoal(name: string, price: number) {
    const res = await fetch(`/api/accounts/${accountId}/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price }),
    });
    const data = await res.json();
    setAccount(data.account);
  }

  async function handleDeleteGoal(id: string) {
    const res = await fetch(`/api/accounts/${accountId}/goals?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    setAccount(data.account);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 text-center">
        <div className="font-display text-2xl text-navy">Loading...</div>
      </div>
    );
  }

  return (
    <div
      data-testid="account-detail-app"
      className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-12"
    >
      <AppHeader
        title={account.name}
        backHref="/"
        backLabel="← Accounts"
        onLogout={handleLogout}
      />

      {account.type === "debt" ? (
        <DebtMonster
          balance={account.balance}
          startingBalance={account.startingBalance ?? 0}
          currency={currency}
        />
      ) : (
        <BalanceCard balance={account.balance} currency={currency} />
      )}

      <MoneyButtons onOpen={setModalType} isDebt={account.type === "debt"} />

      {account.type !== "debt" && (
        <>
          <GoalTimeline
            balance={account.balance}
            goals={account.goals}
            currency={currency}
            onDelete={handleDeleteGoal}
          />
          <AddGoalForm onAdd={handleAddGoal} currency={currency} />
        </>
      )}

      <TransactionFeed
        transactions={account.transactions}
        currency={currency}
        categories={categories}
        isDebt={account.type === "debt"}
        onDelete={handleDeleteTransaction}
      />

      {modalType && (
        <AmountEntryModal
          type={modalType}
          currency={currency}
          categories={categories}
          isDebt={account.type === "debt"}
          onClose={() => setModalType(null)}
          onConfirm={handleConfirmTransaction}
        />
      )}

      <Confetti pieces={confettiPieces} />
    </div>
  );
}
