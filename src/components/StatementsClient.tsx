"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Statement } from "@/lib/statements";
import AppHeader from "@/components/AppHeader";
import PageShell from "@/components/PageShell";

export default function StatementsClient() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const [statements, setStatements] = useState<Statement[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/statements")
      .then((res) => res.json())
      .then((data) => setStatements(data.statements ?? []));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/statements", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setStatements((prev) => [data.statement, ...(prev ?? [])]);
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteStatement(id: string) {
    await fetch(`/api/statements?id=${id}`, { method: "DELETE" });
    setStatements((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  return (
    <PageShell>
      <AppHeader title="STATEMENTS" onLogout={handleLogout} />

      <div
        data-testid="upload-statement-card"
        className="chunky-card p-5 sm:p-6 mb-5"
        style={{ backgroundColor: "var(--gus-yellow)" }}
      >
        <h2 className="font-display text-xl text-navy mb-2">UPLOAD A STATEMENT</h2>
        <p className="font-display text-sm text-navy/70 mb-3">
          CSV or Excel. Money Buddy reads it and gives you a quick analysis — nothing here touches
          your accounts or transactions.
        </p>
        <label
          data-testid="upload-statement-label"
          className="chunky-btn w-full py-3 text-center text-lg text-navy block cursor-pointer"
          style={{ backgroundColor: "white" }}
        >
          {uploading ? "Analyzing..." : "⬆️ Choose a file"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
            data-testid="statement-file-input"
          />
        </label>
        {error && (
          <p
            className="font-display text-sm text-white mt-3 text-center rounded-2xl py-2"
            style={{ backgroundColor: "var(--gus-orange)" }}
          >
            {error}
          </p>
        )}
      </div>

      {!statements ? (
        <p className="font-display text-sm text-navy/60 text-center">Loading...</p>
      ) : statements.length === 0 ? (
        <p className="font-display text-sm text-navy/60 text-center">
          No statements uploaded yet.
        </p>
      ) : (
        statements.map((s) => (
          <div
            key={s.id}
            data-testid={`statement-${s.id}`}
            className="chunky-card p-4 sm:p-5 mb-3"
            style={{ backgroundColor: "white" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-navy truncate">{s.filename}</span>
              <button
                data-testid={`delete-statement-${s.id}`}
                aria-label={`Delete ${s.filename}`}
                onClick={() => deleteStatement(s.id)}
                className="w-8 h-8 rounded-full border-2 border-navy flex items-center justify-center text-sm shrink-0"
              >
                ✕
              </button>
            </div>
            {s.analysis ? (
              <p
                data-testid={`statement-analysis-${s.id}`}
                className="font-display text-sm text-navy whitespace-pre-wrap"
              >
                {s.analysis}
              </p>
            ) : (
              <p className="font-display text-sm text-navy/50 italic">No analysis available.</p>
            )}
          </div>
        ))
      )}
    </PageShell>
  );
}
