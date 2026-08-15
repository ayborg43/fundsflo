"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NetWorthPoint } from "@/lib/networth";
import { formatMoney } from "@/lib/format";
import NetWorthTrend from "@/components/NetWorthTrend";
import AIInsightsCard from "@/components/AIInsightsCard";

export default function InsightsClient({ currency }: { currency: string }) {
  const [netWorth, setNetWorth] = useState<number | null>(null);
  const [history, setHistory] = useState<NetWorthPoint[]>([]);

  useEffect(() => {
    fetch("/api/net-worth")
      .then((res) => res.json())
      .then((data) => {
        const h: NetWorthPoint[] = data.history ?? [];
        setHistory(h);
        setNetWorth(h.length > 0 ? h[h.length - 1].netWorth : 0);
      });
  }, []);

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
      <header className="flex items-center justify-between mb-6 gap-2">
        <Link href="/" className="font-display text-xs sm:text-sm text-navy/70 underline">
          ← Back
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl text-navy tracking-tight">INSIGHTS</h1>
        <div className="w-10" />
      </header>

      {netWorth !== null && (
        <div
          data-testid="net-worth-card"
          className="chunky-card p-5 sm:p-6 text-center mb-3"
          style={{ backgroundColor: "var(--gus-cyan)" }}
        >
          <div className="font-display text-sm text-navy/80 uppercase tracking-wide">Net worth</div>
          <div className="font-display text-4xl sm:text-5xl text-navy">
            {formatMoney(netWorth, currency)}
          </div>
        </div>
      )}

      <NetWorthTrend history={history} />

      <AIInsightsCard />
    </div>
  );
}
