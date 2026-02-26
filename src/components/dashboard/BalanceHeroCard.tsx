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
      <Card className="rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-5">
        <p className="text-xs text-muted-foreground">Total Saldo</p>
        <Skeleton className="mt-1 h-9 w-48" />
        <Skeleton className="mt-1 h-4 w-32" />
      </Card>
    );
  }

  return (
    <Card className="rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-5">
      <p className="text-xs text-muted-foreground">Total Saldo</p>
      <h2 className="text-[32px] font-bold tracking-tight text-foreground">
        {formatIDR(totalBalance)}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {activeWalletCount} dompet aktif
      </p>
    </Card>
  );
}
