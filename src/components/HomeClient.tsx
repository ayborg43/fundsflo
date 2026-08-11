"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Account, TransactionType } from "@/lib/types";
import BalanceCard from "@/components/BalanceCard";
import MoneyButtons from "@/components/MoneyButtons";
import AmountEntryModal from "@/components/AmountEntryModal";
import GoalTimeline from "@/components/GoalTimeline";
import AddGoalForm from "@/components/AddGoalForm";
import TransactionFeed from "@/components/TransactionFeed";
import Confetti, { makeConfettiPieces } from "@/components/Confetti";
import MobileMenu from "@/components/MobileMenu";

export default function HomeClient({ email, currency }: { email: string; currency: string }) {
  const router = useRouter();
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
    <div data-testid="fundsflow-app" className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
      <header className="flex items-center justify-between mb-6 gap-2">
        <Link
          href="/settings"
          data-testid="settings-link"
          className="hidden sm:block font-display text-xs sm:text-sm text-navy/70 underline w-16 sm:w-24"
        >
          Settings
        </Link>
        <div className="sm:hidden w-10">
          <MobileMenu
            items={[
              { label: "Settings", href: "/settings" },
              { label: "Log out", onClick: handleLogout },
            ]}
          />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-navy tracking-tight text-center">
          FUNDSFLOW
        </h1>
        <div className="hidden sm:flex w-16 sm:w-24 justify-end">
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="font-display text-xs sm:text-sm text-navy/70 underline"
          >
            Log out
          </button>
        </div>
        <div className="sm:hidden w-10" aria-hidden="true" />
      </header>

      <p className="font-display text-sm text-navy/60 text-center -mt-4 mb-4 truncate">
        {email}
      </p>

      <BalanceCard balance={account.balance} currency={currency} />
      <MoneyButtons onOpen={setModalType} />
      <GoalTimeline
        balance={account.balance}
        goals={account.goals}
        currency={currency}
        onDelete={handleDeleteGoal}
      />
      <AddGoalForm onAdd={handleAddGoal} currency={currency} />
      <TransactionFeed
        transactions={account.transactions}
        currency={currency}
        onDelete={handleDeleteTransaction}
      />

      <div className="text-center font-display text-sm text-navy/60 mt-6">
        keep stacking 💰
      </div>

      {modalType && (
        <AmountEntryModal
          type={modalType}
          currency={currency}
          onClose={() => setModalType(null)}
          onConfirm={handleConfirmTransaction}
        />
      )}

      <Confetti pieces={confettiPieces} />
    </div>
  );
}
