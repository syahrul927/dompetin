"use client";

import React, { useEffect } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BalanceHeroCard } from "@/components/dashboard/BalanceHeroCard";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { WalletScroll } from "@/components/dashboard/WalletScroll";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";
import { getWalletContext } from "@/lib/transaction-helpers";

/**
 * Main Dashboard page - landing page after authentication.
 * Shows balance, summary cards, wallets, trends, and recent transactions.
 */
export default function DashboardPage() {
  const { workspaceId } = useActiveWorkspace();
  const { data: session } = authClient.useSession();

  const hasWorkspace = !!workspaceId;

  // Background sync for legacy data
  const syncBalances = api.wallet.syncBalances.useMutation();
  const utils = api.useUtils();

  useEffect(() => {
    if (hasWorkspace) {
      syncBalances.mutate(
        { workspaceId },
        {
          onSuccess: () => {
            // Silently invalidate to refresh UI if balances changed
            void utils.wallet.getWallets.invalidate();
            void utils.transaction.getDashboardSummary.invalidate();
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, hasWorkspace]); // Only run when workspace changes

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

  // Dashboard summary (monthly income/expense + trend)
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
        type,
        walletContext: getWalletContext(tx.type, tx.wallet as any, tx.toWallet as any),
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
        />

        <SummaryCards
          monthlyIncome={summary?.monthlyIncome ?? 0}
          monthlyExpense={summary?.monthlyExpense ?? 0}
          isLoading={summaryLoading}
        />

        <WalletScroll
          wallets={wallets ?? []}
          isLoading={walletsLoading}
        />

        <TrendChart
          data={summary?.trend ?? []}
          isLoading={summaryLoading}
        />

        <RecentTransactions
          transactions={recentTransactions}
          isLoading={transactionsLoading}
        />
      </div>
  );
}
