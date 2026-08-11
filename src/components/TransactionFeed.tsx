import type { Transaction } from "@/lib/types";
import { formatMoney, formatRelativeTime } from "@/lib/format";

export default function TransactionFeed({
  transactions,
  currency,
  onDelete,
}: {
  transactions: Transaction[];
  currency: string;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      data-testid="transaction-feed"
      className="chunky-card p-5 sm:p-6 mt-5"
      style={{ backgroundColor: "white" }}
    >
      <h2 className="font-display text-2xl sm:text-3xl text-navy mb-3">WHAT HAPPENED</h2>
      {transactions.length === 0 ? (
        <p className="font-display text-base text-navy/60">
          Nothing yet — make or spend some money to get started!
        </p>
      ) : (
        <ul className="space-y-3">
          {transactions.map((tx) => {
            const isMake = tx.type === "make";
            const label = tx.description || (isMake ? "Money earned!" : "");
            return (
              <li
                key={tx.id}
                data-testid={`tx-${tx.id}`}
                className="feed-item flex items-center justify-between gap-3 rounded-2xl border-3 border-navy p-3 sm:p-4"
                style={{
                  backgroundColor: isMake ? "rgb(232, 255, 216)" : "rgb(255, 227, 220)",
                  borderWidth: 3,
                  boxShadow: "var(--gus-navy) 0px 3px 0px 0px",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      data-testid={`tx-amount-${tx.id}`}
                      className="font-display text-2xl sm:text-3xl"
                      style={{ color: isMake ? "rgb(88, 160, 30)" : "rgb(214, 50, 26)" }}
                    >
                      {isMake ? "+" : "−"}
                      {formatMoney(tx.amount, currency)}
                    </span>
                    {tx.tag && (
                      <span
                        className="font-display text-[10px] uppercase text-white px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "var(--gus-navy)" }}
                      >
                        {tx.tag}
                      </span>
                    )}
                  </div>
                  {label && (
                    <div className="font-display text-base sm:text-lg text-navy mt-0.5 truncate">
                      {label}
                    </div>
                  )}
                  <div className="font-display text-xs text-navy/60 mt-1">
                    {formatRelativeTime(tx.timestamp)}
                  </div>
                </div>
                <button
                  data-testid={`delete-tx-${tx.id}`}
                  aria-label="Delete transaction"
                  onClick={() => onDelete(tx.id)}
                  className="w-10 h-10 rounded-full border-3 border-navy flex items-center justify-center hover:scale-105 transition-transform shrink-0 bg-white"
                  style={{ borderWidth: 3, boxShadow: "var(--gus-navy) 0px 3px 0px 0px" }}
                >
                  🗑
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
