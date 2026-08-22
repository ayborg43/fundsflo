"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { NetWorthPoint } from "@/lib/networth";
import { formatMoney } from "@/lib/format";
import NetWorthTrend from "@/components/NetWorthTrend";
import AIInsightsCard from "@/components/AIInsightsCard";
import AppHeader from "@/components/AppHeader";
import PageShell from "@/components/PageShell";

export default function InsightsClient({ currency }: { currency: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

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
    <PageShell>
      <AppHeader title="INSIGHTS" onLogout={handleLogout} />

      {netWorth !== null && (
        <div
          data-testid="net-worth-card"
          className="chunky-card p-5 sm:p-6 text-center mb-3"
          style={{ backgroundColor: "var(--gus-cyan)" }}
        >
          <div className="font-display text-xs uppercase tracking-[0.14em] text-navy/80">
            Net worth
          </div>
          <div className="font-display tnum text-4xl text-navy sm:text-5xl">
            {formatMoney(netWorth, currency)}
          </div>
        </div>
      )}

      <NetWorthTrend history={history} />

      <AIInsightsCard />
    </PageShell>
  );
}
