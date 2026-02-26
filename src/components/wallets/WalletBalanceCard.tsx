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
    <Card className="relative overflow-hidden rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-6 text-center dark:bg-primary/10 dark:bg-none">
      <div
        className="absolute inset-0 hidden opacity-[0.03] dark:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      />
      <div className="relative z-10">
        <p className="text-xs text-muted-foreground">Saldo Saat Ini</p>
        <h2 className="text-[32px] font-bold tracking-tight text-foreground">
          {formatIDR(balance)}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">{walletType}</p>
      </div>
    </Card>
  );
}
