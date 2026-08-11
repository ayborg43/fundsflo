import { formatMoney } from "@/lib/format";

export default function DebtMonster({
  balance,
  startingBalance,
  currency,
}: {
  balance: number;
  startingBalance: number;
  currency: string;
}) {
  const owed = Math.max(0, -balance);
  const paidOff = Math.max(0, startingBalance - owed);
  const percent = startingBalance > 0 ? Math.min(100, (paidOff / startingBalance) * 100) : 0;
  const isPaidOff = owed <= 0;
  const monsterSize = 72 - percent * 0.4; // shrinks from 72px to 32px as it's paid off

  return (
    <div
      data-testid="debt-monster"
      className="chunky-card relative overflow-hidden text-center p-6 sm:p-8"
      style={{ backgroundColor: isPaidOff ? "var(--gus-lime)" : "var(--gus-orange)" }}
    >
      <div className="font-display text-base sm:text-lg text-navy/80 uppercase tracking-wide">
        {isPaidOff ? "Defeated!" : "You owe"}
      </div>
      <div
        data-testid="debt-owed-amount"
        className="font-display text-5xl sm:text-7xl text-navy break-all"
      >
        {formatMoney(owed, currency)}
      </div>
      <div
        className="my-4 transition-all duration-500"
        style={{ fontSize: `${monsterSize}px`, lineHeight: 1 }}
      >
        {isPaidOff ? "🎉" : "👹"}
      </div>

      <div
        className="relative h-5 rounded-full border-2 border-navy overflow-hidden"
        style={{ backgroundColor: "#ffe9c2" }}
      >
        <div
          data-testid="debt-progress-fill"
          className="absolute left-0 top-0 h-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%`, backgroundColor: "var(--gus-lime)" }}
        />
      </div>
      <div className="flex justify-between font-display text-sm text-navy mt-2">
        <span>{formatMoney(paidOff, currency)} paid off</span>
        <span>{Math.round(percent)}%</span>
      </div>
    </div>
  );
}
