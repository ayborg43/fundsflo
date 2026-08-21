"use client";

import { usePathname } from "next/navigation";

import MobileMenu, { type MenuItem } from "@/components/MobileMenu";

export default function AppHeader({
  title,
  backHref,
  backLabel,
  email,
  onLogout,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  // Shown inside the menu rather than on the screen itself: knowing which
  // account you're in matters occasionally, and it was taking the most
  // valuable strip on a phone.
  email?: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  const allItems: MenuItem[] = [
    ...(backHref ? [{ label: backLabel ?? "Back", href: backHref }] : []),
    { label: "Money Buddy Chat", href: "/" },
    { label: "Accounts", href: "/accounts" },
    { label: "Insights", href: "/insights" },
    { label: "Statements", href: "/statements" },
    { label: "Budgets", href: "/budgets" },
    { label: "Bills", href: "/bills" },
    { label: "Categories", href: "/categories" },
    { label: "Settings", href: "/settings" },
    { label: "Log out", onClick: onLogout },
  ];

  // Drop the link to wherever we already are -- every screen now reaches every
  // other one through this one menu, so self-links are just noise.
  const menuItems = allItems.filter((item) => item.href !== pathname);

  return (
    <header className="mb-6 flex shrink-0 items-center justify-between gap-2">
      <div className="w-11">
        <MobileMenu items={menuItems} email={email} />
      </div>
      <h1 className="font-display truncate px-2 text-center text-3xl tracking-tight text-navy sm:text-4xl">
        {title}
      </h1>
      <div className="w-11" aria-hidden="true" />
    </header>
  );
}
