"use client";

import React, { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BalanceHeroCard } from "@/components/dashboard/BalanceHeroCard";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { WalletScroll } from "@/components/dashboard/WalletScroll";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";
import { getWalletContext } from "@/lib/transaction-helpers";
import { useAnalytics } from "@/hooks/use-analytics";

/**
 * Main Dashboard page - landing page after authentication.
 * Shows balance, summary cards, wallets, trends, and recent transactions.
 */
export default function DashboardPage() {
  const { workspaceId } = useActiveWorkspace();
  const { data: session } = authClient.useSession();
  const { trackEvent } = useAnalytics();

  const hasWorkspace = !!workspaceId;

  // Balance visibility toggle (shared across BalanceHeroCard + WalletScroll)
  const [showBalance, setShowBalance] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("dompetin_show_balance");
    if (stored !== null) setShowBalance(stored === "true");
  }, []);
  const toggleBalance = () => {
    const next = !showBalance;
    setShowBalance(next);
    localStorage.setItem("dompetin_show_balance", String(next));
    trackEvent("balance_visibility_toggled", { visible: next });
  };

  // Workspace info
  const { data: workspaceData } = api.workspace.getWorkspace.useQuery(
    { id: workspaceId },
    { enabled: hasWorkspace },
  );

  // Wallets
  const { data: wallets, isLoading: walletsLoading } =
    api.wallet.getWallets.useQuery(
      { workspaceId },
      { enabled: hasWorkspace },
    );

  // Dashboard summary (monthly income/expense)
  const { data: summary, isLoading: summaryLoading } =
    api.transaction.getDashboardSummary.useQuery(
      { workspaceId },
      { enabled: hasWorkspace },
    );

  // Recent transactions
  const { data: recentData, isLoading: transactionsLoading } =
    api.transaction.getTransactions.useQuery(
      { workspaceId, limit: 5 },
      { enabled: hasWorkspace },
    );

  // Derived data
  const user = session?.user;
  const userInitials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "??";

  const totalBalance =
    wallets?.reduce((sum, w) => sum + parseFloat(w.balance), 0) ?? 0;
  const activeWalletCount = wallets?.length ?? 0;

  // Transform transactions for RecentTransactions component
  const recentTransactions =
    recentData?.transactions.map((tx) => {
      const amount = Math.abs(parseFloat(tx.amount));
      let type: "income" | "expense" | "transfer_debit" | "transfer_credit" =
        tx.type as "income" | "expense";

      if (tx.type === "transfer") {
        type = parseFloat(tx.amount) < 0 ? "transfer_debit" : "transfer_credit";
      }

      const dateStr = new Date(tx.date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });

      return {
        id: tx.id,
        name: tx.name,
        category: tx.category?.name ?? "Tanpa Kategori",
        categoryIcon: tx.category?.icon,
        categoryColor: tx.category?.color,
        date: dateStr,
        amount,
        feeAmount: (tx as { feeAmount?: number }).feeAmount,
        type,
        walletContext: getWalletContext(
          tx.type,
          (tx as { wallet?: { name: string } | null }).wallet,
          (tx as { toWallet?: { name: string } | null }).toWallet
        ),
        authorName: tx.createdBy?.name,
        createdBy: tx.createdBy,
        raw: tx,
      };
    }) ?? [];

  return (
    <div className="space-y-6 px-5 pt-6">
      <DashboardHeader
        workspace={
          workspaceData
            ? { name: workspaceData.name, icon: workspaceData.icon }
              : null
          }
          user={
            user
              ? { name: user.name, initials: userInitials, image: user.image }
              : null
          }
          isLoading={!workspaceData && hasWorkspace}
        />

        <BalanceHeroCard
          totalBalance={totalBalance}
          activeWalletCount={activeWalletCount}
          isLoading={walletsLoading}
          showBalance={showBalance}
          onToggleBalance={toggleBalance}
        />

        <SummaryCards
          dailyIncome={summary?.dailyIncome ?? 0}
          dailyExpense={summary?.dailyExpense ?? 0}
          isLoading={summaryLoading}
        />

        <WalletScroll
          wallets={wallets ?? []}
          isLoading={walletsLoading}
          showBalance={showBalance}
        />

        <RecentTransactions
          transactions={recentTransactions}
          isLoading={transactionsLoading}
        />
      </div>
  );
}
