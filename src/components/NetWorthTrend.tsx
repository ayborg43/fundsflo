import type { NetWorthPoint } from "@/lib/networth";

export default function NetWorthTrend({ history }: { history: NetWorthPoint[] }) {
  // A single data point can't be a trend, but vanishing left the whole screen
  // looking broken. Say what's missing and when it arrives instead.
  if (history.length < 2) {
    return (
      <div
        data-testid="net-worth-trend-empty"
        className="chunky-card mt-3 p-4 sm:p-5"
        style={{ backgroundColor: "white" }}
      >
        <div className="font-display mb-1 text-sm uppercase tracking-[0.1em] text-ink-2">
          Net worth trend
        </div>
        <p className="text-sm leading-relaxed text-ink-2">
          Your line shows up once there are a couple of days of history. Keep logging and it fills
          in on its own.
        </p>
      </div>
    );
  }

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
      <div className="font-display mb-1 text-sm uppercase tracking-[0.1em] text-ink-2">
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
