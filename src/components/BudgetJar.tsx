import type { Budget, Category } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export default function BudgetJar({
  budget,
  category,
  currency,
  onDelete,
}: {
  budget: Budget;
  category: Category | undefined;
  currency: string;
  onDelete: (id: string) => void;
}) {
  const percent = budget.monthlyLimit > 0 ? Math.min(100, (budget.spentThisMonth / budget.monthlyLimit) * 100) : 0;
  const overBudget = budget.spentThisMonth > budget.monthlyLimit;

  return (
    <div
      data-testid={`budget-${budget.id}`}
      className="chunky-card p-4 sm:p-5 mb-3"
      style={{ backgroundColor: "white" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-lg text-navy">
          {category ? `${category.emoji} ${category.name}` : "Unknown category"}
        </span>
        <button
          data-testid={`delete-budget-${budget.id}`}
          aria-label="Delete budget"
          onClick={() => onDelete(budget.id)}
          className="w-7 h-7 rounded-full border-2 border-navy flex items-center justify-center text-xs"
        >
          ✕
        </button>
      </div>
      <div
        className="relative h-6 rounded-full border-2 border-navy overflow-hidden"
        style={{ backgroundColor: "#ffe9c2" }}
      >
        <div
          data-testid={`budget-fill-${budget.id}`}
          className="absolute left-0 top-0 h-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            backgroundColor: overBudget ? "var(--gus-orange)" : "var(--gus-lime)",
          }}
        />
      </div>
      <div className="flex justify-between font-display text-sm text-navy mt-1">
        <span>{formatMoney(budget.spentThisMonth, currency)} spent</span>
        <span>of {formatMoney(budget.monthlyLimit, currency)}</span>
      </div>
    </div>
  );
}
