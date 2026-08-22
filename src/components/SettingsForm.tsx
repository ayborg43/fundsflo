"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CURRENCIES } from "@/lib/currency";
import type { AccountSummary } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import PageShell from "@/components/PageShell";

export default function SettingsForm({
  email,
  currency,
  defaultAccountId,
}: {
  email: string;
  currency: string;
  defaultAccountId: string | null;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const [selected, setSelected] = useState(currency);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [defaultAccount, setDefaultAccount] = useState(defaultAccountId);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts ?? []));
  }, []);

  async function saveDefaultAccount(next: string | null) {
    const previous = defaultAccount;
    setDefaultAccount(next);
    setAccountError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultAccountId: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setAccountError(data?.error ?? "Could not save");
      setDefaultAccount(previous);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult(`Imported ${data.imported} transaction${data.imported === 1 ? "" : "s"}!`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

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
    <PageShell>
      <AppHeader title="SETTINGS" email={email} onLogout={handleLogout} />

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

        <h2 className="font-display text-xl text-navy mb-1 mt-6">Default account</h2>
        <p className="font-display text-sm text-navy/60 mb-3">
          Where Money Buddy puts money you log in the chat without naming an account.
        </p>
        {accounts.length === 0 ? (
          <p className="font-display text-sm text-navy/60">
            No accounts yet — add one from Accounts in the menu first.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {accounts.map((a) => (
              <button
                key={a.id}
                data-testid={`default-account-${a.id}`}
                onClick={() => saveDefaultAccount(defaultAccount === a.id ? null : a.id)}
                className="chunky-btn py-3 px-4 text-left flex items-center justify-between text-lg"
                style={{
                  backgroundColor: defaultAccount === a.id ? "var(--gus-lime)" : "white",
                }}
              >
                <span className="truncate">{a.name}</span>
                {defaultAccount === a.id && <span>✓</span>}
              </button>
            ))}
          </div>
        )}
        {accountError && (
          <p
            className="font-display text-sm text-white mt-2 text-center rounded-2xl py-2"
            style={{ backgroundColor: "var(--gus-orange)" }}
          >
            {accountError}
          </p>
        )}

        <h2 className="font-display text-xl text-navy mb-3 mt-6">Data</h2>
        <div className="flex flex-col gap-3">
          <a
            href="/api/export"
            data-testid="export-csv-link"
            className="chunky-btn py-3 px-4 text-center text-lg"
            style={{ backgroundColor: "white" }}
          >
            ⬇️ Export CSV
          </a>
          <label
            data-testid="import-csv-label"
            className="chunky-btn py-3 px-4 text-center text-lg cursor-pointer"
            style={{ backgroundColor: "white" }}
          >
            {importing ? "Importing..." : "⬆️ Import CSV"}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
              data-testid="import-csv-input"
            />
          </label>
        </div>
        {importResult && (
          <p className="font-display text-sm text-navy mt-2 text-center">{importResult}</p>
        )}
        {importError && (
          <p
            className="font-display text-sm text-white mt-2 text-center rounded-2xl py-2"
            style={{ backgroundColor: "var(--gus-orange)" }}
          >
            {importError}
          </p>
        )}
      </div>
    </PageShell>
  );
}
