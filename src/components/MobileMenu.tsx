"use client";

import { useState } from "react";
import Link from "next/link";

export type MenuItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export default function MobileMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        data-testid="mobile-menu-btn"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-full border-3 border-navy flex items-center justify-center bg-white"
        style={{ borderWidth: 3, boxShadow: "var(--gus-navy) 0px 3px 0px 0px" }}
      >
        <span className="font-display text-xl text-navy leading-none">☰</span>
      </button>

      {open && (
        <div
          data-testid="mobile-menu-overlay"
          className="fixed inset-0 z-50 flex justify-end fade-in"
          style={{ backgroundColor: "rgba(42, 45, 124, 0.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="drawer-slide-in w-64 max-w-[80vw] h-full bg-white border-l-4 border-navy p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl text-navy">Menu</h2>
              <button
                data-testid="close-mobile-menu-btn"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full border-2 border-navy flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col">
              {items.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="font-display text-lg text-navy py-3 border-b border-navy/10"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                    className="font-display text-lg text-navy py-3 text-left border-b border-navy/10"
                  >
                    {item.label}
                  </button>
                )
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
