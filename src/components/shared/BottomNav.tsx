"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Clock, Target, User, ArrowRightLeft } from "lucide-react";

const NAV_ITEMS = [
  { label: "Beranda", icon: Home, route: "/dashboard" },
  { label: "Transaksi", icon: ArrowRightLeft, route: "/transactions" },
  { label: "Dompet", icon: Wallet, route: "/wallets" },
  { label: "Anggaran", icon: Clock, route: "/budget" },
  { label: "Profil", icon: User, route: "/profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-3 shadow-[0_4px_24px_rgba(28,26,24,0.08)]">
      {NAV_ITEMS.map(({ label, icon: Icon, route }) => {
        const isActive =
          pathname === route || pathname.startsWith(`${route}/`);

        return (
          <Link
            key={route}
            href={route}
            className={`flex min-w-14 flex-col items-center justify-center gap-0.5 rounded-full px-3.5 py-2 transition-transform duration-150 active:scale-95 ${
              isActive ? "text-primary" : "text-muted-foreground/60"
            }`}
          >
            <Icon size={20} strokeWidth={2} />
            {isActive && (
              <span className="text-[10px] font-medium">{label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
