import { formatMoney } from "@/lib/format";

export default function BalanceCard({ balance, currency }: { balance: number; currency: string }) {
  return (
    <div
      data-testid="balance-card"
      className="chunky-card relative overflow-hidden text-center p-6 sm:p-8"
      style={{ backgroundColor: "var(--gus-cyan)" }}
    >
      <div className="relative">
        <div className="font-display text-base sm:text-lg text-navy/80 uppercase tracking-wide">
          You have
        </div>
        <div
          data-testid="balance-amount"
          className="font-display text-5xl sm:text-7xl text-navy break-all"
        >
          {formatMoney(balance, currency)}
        </div>
        <div className="font-display text-sm sm:text-base text-navy/70 mt-2">
          Keep stacking! 💰
        </div>
      </div>
    </div>
  );
}
