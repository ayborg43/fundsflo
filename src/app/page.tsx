"use client";

import { useEffect, useState } from "react";
import type { Account, TransactionType } from "@/lib/types";
import BalanceCard from "@/components/BalanceCard";
import MoneyButtons from "@/components/MoneyButtons";
import AmountEntryModal from "@/components/AmountEntryModal";
import GoalTimeline from "@/components/GoalTimeline";
import AddGoalForm from "@/components/AddGoalForm";
import TransactionFeed from "@/components/TransactionFeed";
import Confetti, { makeConfettiPieces } from "@/components/Confetti";

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [modalType, setModalType] = useState<TransactionType | null>(null);
  const [confettiPieces, setConfettiPieces] = useState<ReturnType<typeof makeConfettiPieces>>([]);

  useEffect(() => {
    fetch("/api/account")
      .then((res) => res.json())
      .then(setAccount);
  }, []);

  function celebrateIfGoalsReached(prevBalance: number, next: Account) {
    const newlyReached = next.goals.some(
      (g) => g.price > prevBalance && g.price <= next.balance
    );
    if (newlyReached) {
      setConfettiPieces(makeConfettiPieces());
      setTimeout(() => setConfettiPieces([]), 2800);
    }
  }

  async function handleConfirmTransaction(amount: number, description: string, tag: string | null) {
    if (!modalType || !account) return;
    const prevBalance = account.balance;
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: modalType, amount, description, tag }),
    });
    const next: Account = await res.json();
    setAccount(next);
    setModalType(null);
    celebrateIfGoalsReached(prevBalance, next);
  }

  async function handleDeleteTransaction(id: string) {
    const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
    setAccount(await res.json());
  }

  async function handleAddGoal(name: string, price: number) {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price }),
    });
    setAccount(await res.json());
  }

  async function handleDeleteGoal(id: string) {
    const res = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    setAccount(await res.json());
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 text-center">
        <div className="font-display text-2xl text-navy">Loading...</div>
      </div>
    );
  }

  return (
    <div data-testid="freeze-fund-app" className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
      <header className="flex justify-center mb-6">
        <h1 className="font-display text-4xl sm:text-5xl text-navy tracking-tight">
          FREEZE FUND
        </h1>
      </header>

      <BalanceCard balance={account.balance} />
      <MoneyButtons onOpen={setModalType} />
      <GoalTimeline balance={account.balance} goals={account.goals} onDelete={handleDeleteGoal} />
      <AddGoalForm onAdd={handleAddGoal} />
      <TransactionFeed transactions={account.transactions} onDelete={handleDeleteTransaction} />

      <div className="text-center font-display text-sm text-navy/60 mt-6">
        keep stacking 💰
      </div>

      {modalType && (
        <AmountEntryModal
          type={modalType}
          onClose={() => setModalType(null)}
          onConfirm={handleConfirmTransaction}
        />
      )}

      <Confetti pieces={confettiPieces} />
    </div>
  );
}
