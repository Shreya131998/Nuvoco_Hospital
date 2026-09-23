"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity, Briefcase, Truck, Pill, Download, LogOut, Menu, X, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: Activity, exact: true },
  { href: "/admin/first-aid", label: "First Aid Boxes", icon: Briefcase },
  { href: "/admin/ambulance", label: "Ambulance / Drivers", icon: Truck },
  { href: "/admin/medicine", label: "OHC Medicines", icon: Pill },
];

export function Sidebar({ backend }: { backend: "sheets" | "supabase" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-surface-2 hover:text-text"
            )}
          >
            <n.icon size={18} className="shrink-0" />
            {n.label}
          </Link>
        );
      })}
      <div className="my-2 border-t border-border" />
      <Link
        href="/admin/export"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text"
      >
        <Download size={18} className="shrink-0" />
        Export to Excel
      </Link>
      <Link
        href="/"
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text"
      >
        <ExternalLink size={18} className="shrink-0" />
        Field forms
      </Link>
    </nav>
  );

  const footer = (
    <div className="border-t border-border pt-3">
      <p className="px-3 text-xs text-muted">
        Data source:{" "}
        <span className="font-medium text-text">
          {backend === "sheets" ? "Google Sheets" : "Postgres"}
        </span>
      </p>
      <button
        onClick={signOut}
        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text"
      >
        <LogOut size={18} className="shrink-0" />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-2 rounded-lg p-2 hover:bg-surface-2"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold">OHC Admin</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">OHC Admin</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 hover:bg-surface-2"
              >
                <X size={18} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface p-4 lg:flex">
        <div className="mb-5 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Nuvoco Sonadih
          </p>
          <p className="text-sm font-semibold">OHC Admin</p>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
