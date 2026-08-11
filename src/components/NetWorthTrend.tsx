import type { NetWorthPoint } from "@/lib/networth";

export default function NetWorthTrend({ history }: { history: NetWorthPoint[] }) {
  if (history.length < 2) return null;

  const width = 300;
  const height = 60;
  const values = history.map((h) => h.netWorth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = history
    .map((h, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((h.netWorth - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trendingUp = values[values.length - 1] >= values[0];

  return (
    <div
      data-testid="net-worth-trend"
      className="chunky-card p-4 sm:p-5 mt-3"
      style={{ backgroundColor: "white" }}
    >
      <div className="font-display text-sm text-navy/60 mb-1">
        Net worth trend {trendingUp ? "📈" : "📉"}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: 56 }}
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--gus-navy)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
