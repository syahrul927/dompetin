"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { WalletCard } from "@/components/shared/WalletCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/use-analytics";

const WALLET_TYPE_LABELS: Record<string, string> = {
  cash: "Tunai",
  bank: "Rekening Bank",
  ewallet: "E-Wallet",
  savings: "Tabungan",
  investment: "Investasi",
};

interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: string | number;
}

interface WalletScrollProps {
  wallets: Wallet[];
  isLoading?: boolean;
  showBalance?: boolean;
}

/**
 * Horizontal scrollable list of wallet cards on the Dashboard.
 */
export function WalletScroll({ wallets, isLoading, showBalance }: WalletScrollProps) {
  const router = useRouter();
  const { trackEvent } = useAnalytics();

  const handleWalletClick = (wallet: Wallet) => {
    trackEvent("wallet_details_viewed", { type: wallet.type, source: "dashboard" });
    router.push(`/wallets/${wallet.id}`);
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Dompet" />
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="min-w-[150px] h-24 rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div>
        <SectionHeader
          title="Dompet"
          action={{
            label: "Tambah →",
            href: "/wallets",
            onClick: () => trackEvent("dashboard_add_wallet_clicked"),
          }}
        />
        <div className="rounded-[20px] bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada dompet. Tambahkan dompet pertama Anda!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Dompet"
        action={{
          label: "Lihat Semua →",
          href: "/wallets",
          onClick: () => trackEvent("dashboard_view_all_wallets_clicked"),
        }}
      />
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {wallets.map((w) => (
          <WalletCard
            key={w.id}
            wallet={{
              id: w.id,
              name: w.name,
              type: WALLET_TYPE_LABELS[w.type] ?? w.type,
              balance: typeof w.balance === "string" ? parseFloat(w.balance) : w.balance,
            }}
            showBalance={showBalance}
            onClick={() => handleWalletClick(w)}
          />
        ))}
      </div>
    </div>
  );
}
