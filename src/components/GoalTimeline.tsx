import type { Goal } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const DOT_COLORS = ["var(--gus-yellow)", "var(--gus-cyan)", "var(--gus-pink)", "var(--gus-lime)"];

function logPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  const pct = (Math.log10(value + 1) / Math.log10(max + 1)) * 100;
  return Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
}

export default function GoalTimeline({
  balance,
  goals,
  currency,
  onDelete,
}: {
  balance: number;
  goals: Goal[];
  currency: string;
  onDelete: (id: string) => void;
}) {
  if (goals.length === 0) {
    return (
      <div
        data-testid="goal-timeline"
        className="chunky-card p-5 sm:p-6 mt-5"
        style={{ backgroundColor: "var(--gus-cream)" }}
      >
        <h2 className="font-display text-2xl sm:text-3xl text-navy mb-1">MY GOALS</h2>
        <p className="font-display text-base text-navy/60">
          No goals yet — add something you want below!
        </p>
      </div>
    );
  }

  const maxValue = Math.max(balance, ...goals.map((g) => g.price));

  return (
    <div
      data-testid="goal-timeline"
      className="chunky-card p-5 sm:p-6 mt-5"
      style={{ backgroundColor: "var(--gus-cream)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl sm:text-3xl text-navy">MY GOALS</h2>
        <span className="font-display text-base text-navy/60">
          {goals.length} goal{goals.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="relative" style={{ paddingTop: 76, paddingBottom: 56 }}>
        <div className="relative" style={{ marginLeft: 32, marginRight: 32 }}>
          {goals.map((goal, i) => {
            const reached = balance >= goal.price;
            const left = logPercent(goal.price, maxValue);
            return (
              <div
                key={goal.id}
                className="absolute flex flex-col items-center"
                style={{ left: `${left}%`, transform: "translateX(-50%)", bottom: 32, width: 90, marginLeft: -45 }}
              >
                <div
                  className="font-display text-[11px] sm:text-xs text-navy leading-tight text-center mb-1 px-1"
                  title={goal.name}
                >
                  {goal.name}
                </div>
                <div
                  data-testid={`goal-dot-${goal.id}`}
                  className={`relative rounded-full border-[3px] border-navy flex items-center justify-center ${reached ? "goal-wobble" : ""}`}
                  style={{
                    width: 44,
                    height: 44,
                    boxShadow: "var(--gus-navy) 0px 4px 0px 0px",
                    backgroundColor: reached ? "#e8ffd8" : "white",
                  }}
                >
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center font-display text-base text-white"
                    style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
                  >
                    {goal.name.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  {reached && (
                    <div
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-navy flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: "var(--gus-lime)" }}
                    >
                      ✓
                    </div>
                  )}
                  <button
                    data-testid={`delete-goal-${goal.id}`}
                    aria-label={`Delete ${goal.name}`}
                    onClick={() => onDelete(goal.id)}
                    className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 border-navy flex items-center justify-center hover:scale-110 transition-transform text-[10px] text-white"
                    style={{ backgroundColor: "var(--gus-pink)" }}
                  >
                    ✕
                  </button>
                </div>
                <div className="w-1 bg-navy" style={{ height: 10, marginTop: -1 }} />
              </div>
            );
          })}

          <div className="relative">
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-4 rounded-full border-2 border-navy"
              style={{ backgroundColor: "#ffe9c2" }}
            />
            <div
              data-testid="progress-fill"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-4 rounded-full border-2 border-navy transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(logPercent(balance, maxValue), 1.5)}%`,
                backgroundColor: "var(--gus-cyan)",
              }}
            />
            <div
              data-testid="balance-marker"
              className="absolute -top-[70px] transition-all duration-700 ease-out z-10"
              style={{ left: `${logPercent(balance, maxValue)}%`, transform: "translateX(-50%)" }}
            >
              <div
                className="font-display text-xs sm:text-sm text-white px-2.5 py-1 rounded-full border-2 border-navy whitespace-nowrap"
                style={{ backgroundColor: "var(--gus-orange)", boxShadow: "var(--gus-navy) 0px 3px 0px 0px" }}
              >
                YOU: {formatMoney(balance, currency)}
              </div>
              <div
                className="w-0 h-0 mx-auto"
                style={{
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "8px solid var(--gus-navy)",
                }}
              />
            </div>
            <div className="h-4" />
          </div>

          {goals.map((goal) => {
            const left = logPercent(goal.price, maxValue);
            const reached = balance >= goal.price;
            return (
              <div
                key={`${goal.id}-label`}
                className="absolute flex flex-col items-center"
                style={{ left: `${left}%`, transform: "translateX(-50%)", top: "calc(100% - 40px)", width: 90, marginLeft: -45 }}
              >
                <div className="w-1 bg-navy" style={{ height: 8 }} />
                <div
                  className="font-display text-sm sm:text-base text-navy mt-1"
                  style={{ textDecoration: reached ? "line-through" : "none", opacity: reached ? 0.65 : 1 }}
                >
                  {formatMoney(goal.price, currency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
