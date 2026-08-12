"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard/admin", label: "Dashboard" },
  { href: "/dashboard/admin/contact", label: "Contact Messages" },
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/payments", label: "Payments" },
  { href: "/dashboard/admin/generations", label: "AI Generations" },
  { href: "/dashboard/admin/promo-codes", label: "Promo Codes" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-brand-ink">Admin</h2>
      <nav className="space-y-2">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard/admin" && pathname.startsWith(item.href));
          return <Link key={item.href} href={item.href} className={`block rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-brand-ink text-white" : "text-brand-muted hover:bg-brand-background hover:text-brand-ink"}`}>{item.label}</Link>;
        })}
      </nav>
    </aside>
  );
}
