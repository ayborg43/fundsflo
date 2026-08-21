"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { AccountSummary } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const TYPE_ICON: Record<AccountSummary["type"], string> = {
  cash: "💵",
  checking: "🏦",
  savings: "🐷",
  credit: "💳",
  debt: "👹",
  investment: "🌳",
};

const TYPE_COLOR: Record<AccountSummary["type"], string> = {
  cash: "var(--gus-lime)",
  checking: "var(--gus-cyan)",
  savings: "var(--gus-yellow)",
  credit: "var(--gus-pink)",
  debt: "var(--gus-orange)",
  investment: "var(--gus-lime)",
};

export default function AccountCard({
  account,
  currency,
  onDelete,
}: {
  account: AccountSummary;
  currency: string;
  onDelete: (id: string) => void;
}) {
  const isDebt = account.type === "debt";
  const owed = isDebt ? Math.max(0, -account.balance) : 0;
  // Deleting an account takes its whole transaction history with it, and it
  // was a single tap on an icon sitting beside an ordinary link. Confirm in
  // place: no modal for something this small, but no accidents either.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <div
      data-testid={`account-card-${account.id}`}
      className="chunky-card mb-3 flex items-center gap-3 p-4 sm:p-5"
      style={{ backgroundColor: TYPE_COLOR[account.type] }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-navy bg-white text-2xl"
        style={{ borderWidth: 3 }}
        aria-hidden="true"
      >
        {TYPE_ICON[account.type]}
      </div>

      {confirming ? (
        <div className="flex flex-1 items-center justify-between gap-2">
          <p className="font-display min-w-0 text-sm text-navy">
            Delete {account.name} and everything in it?
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              data-testid={`confirm-delete-account-${account.id}`}
              onClick={() => onDelete(account.id)}
              className="chunky-btn font-display px-3 py-2 text-sm text-white"
              style={{ backgroundColor: "var(--gus-navy)", borderRadius: 999 }}
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="chunky-btn font-display bg-white px-3 py-2 text-sm text-navy"
              style={{ borderRadius: 999 }}
            >
              Keep
            </button>
          </div>
        </div>
      ) : (
        <>
          <Link href={`/accounts/${account.id}`} className="min-w-0 flex-1">
            <div className="font-display truncate text-lg text-navy">{account.name}</div>
            <div className="font-display tnum text-2xl text-navy">
              {isDebt ? `Owe ${formatMoney(owed, currency)}` : formatMoney(account.balance, currency)}
            </div>
          </Link>
          <button
            data-testid={`delete-account-${account.id}`}
            aria-label={`Delete ${account.name}`}
            onClick={() => setConfirming(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-navy bg-white text-navy transition-transform hover:scale-105"
            style={{ borderWidth: 3 }}
          >
            <Icon name="trash" size={17} />
          </button>
        </>
      )}
    </div>
  );
}
