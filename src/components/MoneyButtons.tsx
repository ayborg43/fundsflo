"use client";

import type { TransactionType } from "@/lib/types";

export default function MoneyButtons({
  onOpen,
}: {
  onOpen: (type: TransactionType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-5">
      <button
        data-testid="make-money-btn"
        onClick={() => onOpen("make")}
        className="chunky-btn py-6 sm:py-7 text-2xl sm:text-3xl text-navy flex flex-col items-center gap-1"
        style={{ backgroundColor: "var(--gus-lime)" }}
      >
        <span className="text-3xl sm:text-4xl">+</span>
        <span>MAKE</span>
        <span className="text-base sm:text-lg font-display opacity-80">MONEY</span>
      </button>
      <button
        data-testid="spend-money-btn"
        onClick={() => onOpen("spend")}
        className="chunky-btn py-6 sm:py-7 text-2xl sm:text-3xl text-white flex flex-col items-center gap-1"
        style={{ backgroundColor: "var(--gus-orange)" }}
      >
        <span className="text-3xl sm:text-4xl">−</span>
        <span>SPEND</span>
        <span className="text-base sm:text-lg font-display opacity-90">MONEY</span>
      </button>
    </div>
  );
}
