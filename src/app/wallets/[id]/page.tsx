"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { WalletBalanceCard } from "@/components/wallets/WalletBalanceCard";
import { WalletActions } from "@/components/wallets/WalletActions";
import { WalletMonthlySummary } from "@/components/wallets/WalletMonthlySummary";
import { WalletTransactionList } from "@/components/wallets/WalletTransactionList";
import { EditWalletDrawer } from "@/components/wallets/EditWalletDrawer";
import { DeleteWalletDialog } from "@/components/wallets/DeleteWalletDialog";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { getWalletContext } from "@/lib/transaction-helpers";

const WALLET_TYPE_LABELS: Record<string, string> = {
  cash: "Tunai",
  bank: "Rekening Bank",
  ewallet: "E-Wallet",
  savings: "Tabungan",
  investment: "Investasi",
};

/**
 * Wallet Detail page — shows balance, actions, monthly summary, and transactions.
 */
export default function WalletDetailPage() {
  const params = useParams();
  const router = useRouter();
  const walletId = params.id as string;
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: walletData, isLoading } = api.wallet.getWallet.useQuery({
    id: walletId,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader variant="back" title="..." onBack={() => router.back()} />
        <div className="space-y-4 px-5 pt-2">
          <Skeleton className="h-[120px] rounded-[20px]" />
          <Skeleton className="h-[44px] rounded-full" />
          <Skeleton className="h-[100px] rounded-[20px]" />
          <Skeleton className="h-[200px] rounded-[20px]" />
        </div>
      </>
    );
  }

  if (!walletData) {
    return (
      <>
        <PageHeader variant="back" title="Dompet" onBack={() => router.back()} />
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Dompet tidak ditemukan</p>
        </div>
      </>
    );
  }

  const typeLabel = WALLET_TYPE_LABELS[walletData.type] ?? walletData.type;

  // Map transactions to the format WalletTransactionList expects
  const mappedTransactions = walletData.transactions.map((tx) => ({
    id: tx.id,
    name: tx.name,
    category: "",
    date: new Date(tx.date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    }),
    amount: parseFloat(tx.amount),
    feeAmount: (tx as { feeAmount?: number }).feeAmount,
    type: tx.type as "income" | "expense" | "transfer_debit" | "transfer_credit",
    walletContext: getWalletContext(
      tx.type,
      (tx as { wallet?: { name: string } | null }).wallet,
      (tx as { toWallet?: { name: string } | null }).toWallet
    ),
    authorName: tx.createdBy?.name,
    createdBy: tx.createdBy,
    raw: tx,
  }));

  const now = new Date();
  const monthLabel = now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader variant="back" title={walletData.name} onBack={() => router.back()} />

      <div className="space-y-6 px-5 pt-2">
        {/* Balance Card */}
        <WalletBalanceCard
          balance={parseFloat(walletData.balance)}
          walletType={typeLabel}
        />

        {/* Action Buttons */}
        <WalletActions
          onTransfer={() => setShowTransactionSheet(true)}
          onEdit={() => setShowEditSheet(true)}
          onDelete={() => setShowDeleteDialog(true)}
        />

        {/* Monthly Summary */}
        <WalletMonthlySummary
          income={walletData.monthlyIncome}
          expense={walletData.monthlyExpense}
        />

        {/* Transaction List */}
        <WalletTransactionList
          transactions={mappedTransactions}
          monthLabel={monthLabel}
        />
      </div>

      {/* Sheets & Dialogs */}
      <AddTransactionSheet
        open={showTransactionSheet}
        onOpenChange={setShowTransactionSheet}
      />

      <EditWalletDrawer
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        wallet={walletData}
      />

      <DeleteWalletDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        wallet={walletData}
      />
    </>
  );
}
