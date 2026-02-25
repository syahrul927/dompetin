"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Clock, User, ArrowRightLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    <nav className="flex h-[52px] items-center gap-0.5 rounded-full border border-border bg-card px-1.5 shadow-[0_4px_24px_rgba(28,26,24,0.08)]">
      {NAV_ITEMS.map(({ label, icon: Icon, route }) => {
        const isActive =
          pathname === route || pathname.startsWith(`${route}/`);

        return (
          <Link
            key={route}
            href={route}
            className={`flex min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 transition-colors duration-150 active:scale-95 ${
              isActive ? "text-primary" : "text-muted-foreground/60"
            }`}
          >
            <Icon size={18} strokeWidth={2.5} />

            <AnimatePresence>
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, height: 0, scale: 0.8 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="text-[9px] font-bold overflow-hidden"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        );
      })}
    </nav>
  );
}
