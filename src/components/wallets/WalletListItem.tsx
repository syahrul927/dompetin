"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatIDR } from "@/lib/formatIDR";
import { getWalletIcon } from "@/lib/wallet-icons";

const WALLET_TYPE_LABELS: Record<string, string> = {
  cash: "Tunai",
  bank: "Rekening Bank",
  ewallet: "E-Wallet",
  savings: "Tabungan",
  investment: "Investasi",
};

interface WalletListItemProps {
  wallet: {
    id: string;
    name: string;
    type: string;
    icon: string;
    balance: string;
  };
  isFirst?: boolean;
  onClick: () => void;
}

/**
 * Full-width wallet row in the Wallets list page.
 * Shows emoji icon, name, type label, and balance.
 */
export function WalletListItem({
  wallet,
  isFirst,
  onClick,
}: WalletListItemProps) {
  const typeLabel = WALLET_TYPE_LABELS[wallet.type] ?? wallet.type;
  const Icon = getWalletIcon(wallet.icon);

  return (
    <Card
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 rounded-[20px] p-4 transition-colors active:bg-muted/50"
    >
      {/* Icon */}
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${
          isFirst ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
        }`}
      >
        <Icon size={20} />
      </div>

      {/* Name + Type */}
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground">{wallet.name}</p>
        <p className="text-[11px] text-muted-foreground">{typeLabel}</p>
      </div>

      {/* Balance */}
      <div className="flex-shrink-0 text-right">
        <p className="text-base font-bold text-foreground">
          {formatIDR(parseFloat(wallet.balance))}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight
        size={16}
        className="ml-auto flex-shrink-0 text-muted-foreground/60"
      />
    </Card>
  );
}
