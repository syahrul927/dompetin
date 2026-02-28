import React, { useState, useEffect } from "react";
import { formatIDR } from "@/lib/formatIDR";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff } from "lucide-react";

interface BalanceHeroCardProps {
  totalBalance: number;
  activeWalletCount: number;
  isLoading?: boolean;
}

/**
 * The dominant visual element on the Dashboard.
 * Shows total workspace balance with gradient background.
 */
export function BalanceHeroCard({
  totalBalance,
  activeWalletCount,
  isLoading,
}: BalanceHeroCardProps) {
  const [showBalance, setShowBalance] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const storedPref = localStorage.getItem("dompetin_show_balance");
    if (storedPref !== null) {
      setShowBalance(storedPref === "true");
    }
  }, []);

  // Save preference when changed
  const toggleBalance = () => {
    const newValue = !showBalance;
    setShowBalance(newValue);
    localStorage.setItem("dompetin_show_balance", String(newValue));
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20 from-card dark:bg-primary/10 relative overflow-hidden rounded-[20px] bg-gradient-to-br to-[#FDF4F5] p-5 dark:bg-none">
        <div
          className="absolute inset-0 hidden opacity-[0.03] dark:block"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative z-10">
          <p className="text-muted-foreground text-xs">Total Saldo</p>
          <Skeleton className="mt-1 h-9 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 from-card dark:bg-primary/10 relative overflow-hidden rounded-[20px] bg-gradient-to-br to-[#FDF4F5] p-5 dark:bg-none">
      <div
        className="absolute inset-0 hidden opacity-[0.03] dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">Total Saldo</p>
          <button
            onClick={toggleBalance}
            className="text-muted-foreground rounded-full p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={showBalance ? "Sembunyikan saldo" : "Tampilkan saldo"}
          >
            {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <h2 className="text-foreground flex h-[48px] items-center text-[32px] font-bold tracking-tight">
          {showBalance ? formatIDR(totalBalance) : "Rp •••••••••"}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {activeWalletCount} dompet aktif
        </p>
      </div>
    </Card>
  );
}
