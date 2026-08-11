"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Category } from "@/lib/types";

const DEFAULT_EMOJI = "🏷️";

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(DEFAULT_EMOJI);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), emoji: emoji.trim() || DEFAULT_EMOJI }),
    });
    const data = await res.json();
    setCategories((prev) => [...(prev ?? []), data.category]);
    setName("");
    setEmoji(DEFAULT_EMOJI);
  }

  async function deleteCategory(id: string) {
    await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    setCategories((prev) => (prev ?? []).filter((c) => c.id !== id));
  }

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
      <header className="flex items-center justify-between mb-6 gap-2">
        <Link href="/" className="font-display text-xs sm:text-sm text-navy/70 underline">
          ← Back
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl text-navy tracking-tight">
          CATEGORIES
        </h1>
        <div className="w-10" />
      </header>

      <div
        data-testid="categories-card"
        className="chunky-card p-6 sm:p-7"
        style={{ backgroundColor: "var(--gus-cream)" }}
      >
        <form className="flex gap-2 mb-5" onSubmit={addCategory}>
          <input
            data-testid="category-emoji-input"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            className="w-14 text-center font-display text-xl rounded-2xl border-4 border-navy px-2 py-3 outline-none bg-white"
            style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
          />
          <input
            data-testid="category-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="e.g. Food"
            className="flex-1 font-display text-lg text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white min-w-0"
            style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
          />
          <button
            data-testid="add-category-btn"
            type="submit"
            disabled={!name.trim()}
            className="chunky-btn px-4 text-lg text-white"
            style={{ backgroundColor: "var(--gus-pink)" }}
          >
            +
          </button>
        </form>

        {!categories ? (
          <p className="font-display text-sm text-navy/60">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="font-display text-sm text-navy/60">
            No categories yet — add one above to start tagging transactions.
          </p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li
                key={c.id}
                data-testid={`category-${c.id}`}
                className="flex items-center justify-between rounded-2xl border-3 border-navy px-4 py-2 bg-white"
                style={{ borderWidth: 3 }}
              >
                <span className="font-display text-navy">
                  {c.emoji} {c.name}
                </span>
                <button
                  data-testid={`delete-category-${c.id}`}
                  aria-label={`Delete ${c.name}`}
                  onClick={() => deleteCategory(c.id)}
                  className="w-8 h-8 rounded-full border-2 border-navy flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
