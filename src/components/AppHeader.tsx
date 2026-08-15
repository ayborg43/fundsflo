"use client";

import MobileMenu, { type MenuItem } from "@/components/MobileMenu";

export default function AppHeader({
  title,
  backHref,
  backLabel,
  onLogout,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  onLogout: () => void;
}) {
  const menuItems: MenuItem[] = [
    ...(backHref ? [{ label: backLabel ?? "Back", href: backHref }] : []),
    { label: "Money Buddy Chat", href: "/chat" },
    { label: "Insights", href: "/insights" },
    { label: "Statements", href: "/statements" },
    { label: "Budgets", href: "/budgets" },
    { label: "Bills", href: "/bills" },
    { label: "Settings", href: "/settings" },
    { label: "Categories", href: "/categories" },
    { label: "Log out", onClick: onLogout },
  ];

  return (
    <header className="flex items-center justify-between mb-6 gap-2">
      <div className="w-10">
        <MobileMenu items={menuItems} />
      </div>
      <h1 className="font-display text-3xl sm:text-5xl text-navy tracking-tight text-center truncate px-2">
        {title}
      </h1>
      <div className="w-10" aria-hidden="true" />
    </header>
  );
}
