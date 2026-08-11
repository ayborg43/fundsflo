"use client";

import { useState } from "react";
import Link from "next/link";
import { CURRENCIES } from "@/lib/currency";

export default function SettingsForm({
  email,
  currency,
}: {
  email: string;
  currency: string;
}) {
  const [selected, setSelected] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string) {
    setSelected(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not save");
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
      <header className="flex items-center justify-between mb-6 gap-2">
        <Link href="/" className="font-display text-xs sm:text-sm text-navy/70 underline">
          ← Back
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl text-navy tracking-tight">
          SETTINGS
        </h1>
        <div className="w-10" />
      </header>

      <div
        data-testid="settings-card"
        className="chunky-card p-6 sm:p-7"
        style={{ backgroundColor: "var(--gus-cream)" }}
      >
        <p className="font-display text-sm text-navy/60 mb-5 truncate">{email}</p>

        <h2 className="font-display text-xl text-navy mb-3">Currency</h2>
        <div className="flex flex-col gap-3">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              data-testid={`currency-${c.code}`}
              onClick={() => save(c.code)}
              disabled={saving}
              className="chunky-btn py-3 px-4 text-left flex items-center justify-between text-lg"
              style={{
                backgroundColor: selected === c.code ? "var(--gus-lime)" : "white",
              }}
            >
              <span>
                {c.symbol} {c.label}
              </span>
              {selected === c.code && <span>✓</span>}
            </button>
          ))}
        </div>

        {saved && (
          <p className="font-display text-sm text-navy mt-4 text-center">
            Saved! 🎉
          </p>
        )}
        {error && (
          <p className="font-display text-sm text-white bg-orange mt-4 text-center rounded-2xl py-2" style={{ backgroundColor: "var(--gus-orange)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
