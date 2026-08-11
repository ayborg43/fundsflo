"use client";

import { useState } from "react";

export default function AddGoalForm({
  onAdd,
}: {
  onAdd: (name: string, price: number) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const parsedPrice = parseFloat(price);
  const canSubmit = name.trim().length > 0 && !Number.isNaN(parsedPrice) && parsedPrice > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd(name.trim(), parsedPrice);
    setName("");
    setPrice("");
  }

  return (
    <div
      data-testid="add-goal-form-card"
      className="chunky-card p-5 sm:p-6 mt-5"
      style={{ backgroundColor: "var(--gus-yellow)" }}
    >
      <h2 className="font-display text-2xl sm:text-3xl text-navy mb-1">WANT SOMETHING?</h2>
      <p className="font-display text-base text-navy/70 mb-4">
        Add it as a goal and see how close you are!
      </p>
      <form className="space-y-3" onSubmit={submit}>
        <input
          data-testid="goal-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="What do you want? (e.g. Lego set)"
          className="w-full font-display text-lg sm:text-xl text-navy rounded-2xl border-4 border-navy px-4 py-3 outline-none bg-white"
          style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
        />
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl sm:text-2xl text-navy pointer-events-none">
              $
            </span>
            <input
              data-testid="goal-price-input"
              inputMode="decimal"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-full font-display text-lg sm:text-xl text-navy rounded-2xl border-4 border-navy pl-9 pr-4 py-3 outline-none bg-white"
              style={{ boxShadow: "var(--gus-navy) 0px 4px 0px 0px" }}
            />
          </div>
          <button
            data-testid="add-goal-btn"
            type="submit"
            disabled={!canSubmit}
            className="chunky-btn px-5 sm:px-6 text-xl flex items-center gap-2 text-white"
            style={{ backgroundColor: "var(--gus-pink)" }}
          >
            + ADD
          </button>
        </div>
      </form>
    </div>
  );
}
