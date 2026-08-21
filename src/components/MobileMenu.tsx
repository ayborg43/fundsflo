"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

export type MenuItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export default function MobileMenu({ items, email }: { items: MenuItem[]; email?: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // A drawer that traps nothing and ignores Escape is a half-built dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        data-testid="mobile-menu-btn"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="chunky-btn flex items-center justify-center bg-white text-navy"
        style={{ height: 44, width: 44, borderRadius: 999, borderWidth: 3, boxShadow: "0 4px 0 0 var(--gus-navy)" }}
      >
        <Icon name="menu" size={20} />
      </button>

      {open && (
        <div
          data-testid="mobile-menu-overlay"
          className="fade-in fixed inset-0 z-50 flex justify-end"
          style={{ backgroundColor: "rgba(42, 45, 124, 0.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="drawer-slide-in flex h-full w-72 max-w-[82vw] flex-col border-l-4 border-navy bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl text-navy">Menu</h2>
              <button
                data-testid="close-mobile-menu-btn"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border-navy text-navy"
                style={{ borderWidth: 3 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <nav className="flex flex-col">
              {items.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="font-display border-b border-navy/10 py-3 text-lg text-navy transition-colors hover:text-pink"
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
                    className="font-display border-b border-navy/10 py-3 text-left text-lg text-navy transition-colors hover:text-pink"
                  >
                    {item.label}
                  </button>
                )
              )}
            </nav>

            {email && (
              <p className="mt-auto truncate pt-5 text-xs text-ink-2" title={email}>
                {email}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
