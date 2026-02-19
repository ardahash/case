import Link from "next/link";
import { WalletStatus } from "@/components/shared/WalletStatus";

const navItems = [
  { label: "Store", href: "/" },
  { label: "Rewards", href: "/rewards" },
  { label: "Stake", href: "/stake" },
  { label: "Legal", href: "/legal" },
  { label: "Provably Fair", href: "/provably-fair" },
];

export function Header() {
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

          <div className="lg:hidden">
            <WalletStatus />
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

      <nav className="border-t border-border/40 bg-background/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground lg:hidden">
        <div className="container flex gap-4 overflow-x-auto scrollbar-hidden">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
