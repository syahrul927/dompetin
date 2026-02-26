import React from "react";
import { formatIDR } from "@/lib/formatIDR";

interface WalletCardProps {
  wallet: {
    id: string;
    name: string;
    type: string;
    balance: number;
  };
  isSelected?: boolean;
  onClick?: () => void;
}

/**
 * Wallet card component used in Dashboard wallet horizontal scroll section.
 */
export function WalletCard({ wallet, isSelected, onClick }: WalletCardProps) {
  return (
    <button
      onClick={onClick}
      className={`min-w-[150px] flex-shrink-0 cursor-pointer rounded-[20px] p-4 shadow-sm transition-all active:scale-[0.97] ${
        isSelected
          ? "border-primary/40 bg-primary/10"
          : "border-transparent bg-card"
      } border`}
    >
      <p className="text-[11px] font-medium text-muted-foreground">
        {wallet.name}
      </p>
      <p className="mt-1 text-[15px] font-bold text-foreground">
        {formatIDR(wallet.balance)}
      </p>
      <p className="mt-2 text-xs font-semibold text-foreground">
        {wallet.type}
      </p>
    </button>
  );
}
