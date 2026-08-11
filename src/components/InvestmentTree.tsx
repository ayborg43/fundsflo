import { formatMoney } from "@/lib/format";

export default function InvestmentTree({
  balance,
  currency,
}: {
  balance: number;
  currency: string;
}) {
  // Purely a visual flourish: the tree grows a bit as the balance grows,
  // capped so it doesn't blow out the layout for very large portfolios.
  const treeSize = Math.min(96, 48 + Math.log10(Math.max(balance, 1) + 1) * 10);

  return (
    <div
      data-testid="investment-tree"
      className="chunky-card relative overflow-hidden text-center p-6 sm:p-8"
      style={{ backgroundColor: "var(--gus-lime)" }}
    >
      <div className="font-display text-base sm:text-lg text-navy/80 uppercase tracking-wide">
        Portfolio value
      </div>
      <div
        data-testid="investment-balance"
        className="font-display text-5xl sm:text-7xl text-navy break-all"
      >
        {formatMoney(balance, currency)}
      </div>
      <div className="my-2 transition-all duration-500" style={{ fontSize: `${treeSize}px`, lineHeight: 1 }}>
        🌳
      </div>
      <div className="font-display text-sm sm:text-base text-navy/70">
        Keep it growing! 🌱
      </div>
    </div>
  );
}
