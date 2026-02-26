import React from "react";
import { formatIDR } from "@/lib/formatIDR";
import { Card } from "@/components/ui/card";

interface WalletBalanceCardProps {
  balance: number;
  walletType: string;
}

/**
 * Centered balance display card on wallet detail page.
 * Uses the same gradient style as the Dashboard BalanceHeroCard.
 */
export function WalletBalanceCard({
  balance,
  walletType,
}: WalletBalanceCardProps) {
  return (
    <Card className="rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-6 text-center">
      <p className="text-xs text-muted-foreground">Saldo Saat Ini</p>
      <h2 className="text-[32px] font-bold tracking-tight text-foreground">
        {formatIDR(balance)}
      </h2>
      <p className="mt-1 text-[11px] text-muted-foreground">{walletType}</p>
    </Card>
  );
}
