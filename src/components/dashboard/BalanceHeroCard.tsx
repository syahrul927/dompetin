import React from "react";
import { formatIDR } from "@/lib/formatIDR";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-5 dark:bg-primary/10 dark:bg-none">
        <div
          className="absolute inset-0 hidden opacity-[0.03] dark:block"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative z-10">
          <p className="text-xs text-muted-foreground">Total Saldo</p>
          <Skeleton className="mt-1 h-9 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-5 dark:bg-primary/10 dark:bg-none">
      <div
        className="absolute inset-0 hidden opacity-[0.03] dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      />
      <div className="relative z-10">
        <p className="text-xs text-muted-foreground">Total Saldo</p>
        <h2 className="text-[32px] font-bold tracking-tight text-foreground">
          {formatIDR(totalBalance)}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {activeWalletCount} dompet aktif
        </p>
      </div>
    </Card>
  );
}
