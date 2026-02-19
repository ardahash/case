"use client";

import Link from "next/link";
import { useState } from "react";
import { WalletStatus } from "@/components/shared/WalletStatus";

const navItems = [
  { label: "Store", href: "/" },
  { label: "Rewards", href: "/rewards" },
  { label: "Stake", href: "/stake" },
  { label: "Based Room", href: "/based-room" },
  { label: "Legal", href: "/legal" },
  { label: "Provably Fair", href: "/provably-fair" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMobileToggle = () => setMobileOpen((open) => !open);
  const handleMobileClose = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card shadow-insetGlow">
              <img src="/caseapp200x200.png" alt="Case app icon" className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Case</div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Base Vault
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            <WalletStatus />
            <button
              type="button"
              onClick={handleMobileToggle}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"
            >
              <span className="sr-only">Toggle navigation</span>
              {mobileOpen ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex">
          <WalletStatus />
        </div>
      </div>

      <nav
        id="mobile-nav"
        className={`border-t border-border/40 bg-background/70 px-4 text-sm text-muted-foreground transition-all lg:hidden ${
          mobileOpen ? "max-h-96 py-3 opacity-100" : "max-h-0 overflow-hidden py-0 opacity-0"
        }`}
      >
        <div className="container flex flex-col gap-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleMobileClose}
              className="rounded-lg px-2 py-2 transition hover:bg-muted/40 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
