import Link from "next/link";
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

  return (
    <div
      data-testid={`account-card-${account.id}`}
      className="chunky-card p-4 sm:p-5 flex items-center gap-3 mb-3"
      style={{ backgroundColor: TYPE_COLOR[account.type] }}
    >
      <div
        className="w-12 h-12 rounded-full border-3 border-navy flex items-center justify-center text-2xl shrink-0 bg-white"
        style={{ borderWidth: 3 }}
      >
        {TYPE_ICON[account.type]}
      </div>
      <Link href={`/accounts/${account.id}`} className="flex-1 min-w-0">
        <div className="font-display text-lg text-navy truncate">{account.name}</div>
        <div className="font-display text-2xl text-navy">
          {isDebt ? `Owe ${formatMoney(owed, currency)}` : formatMoney(account.balance, currency)}
        </div>
      </Link>
      <button
        data-testid={`delete-account-${account.id}`}
        aria-label={`Delete ${account.name}`}
        onClick={() => onDelete(account.id)}
        className="w-9 h-9 rounded-full border-3 border-navy flex items-center justify-center hover:scale-105 transition-transform shrink-0 bg-white"
        style={{ borderWidth: 3 }}
      >
        ✕
      </button>
    </div>
  );
}
