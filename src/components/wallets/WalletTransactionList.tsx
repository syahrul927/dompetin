"use client";

import React, { useState } from "react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionActionSheet } from "@/components/transaction/TransactionActionSheet";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { authClient } from "@/server/better-auth/client";
import { useAnalytics } from "@/hooks/use-analytics";

interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  feeAmount?: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  authorName?: string;
  createdBy?: { id: string; name: string } | null;
  raw?: Record<string, unknown>;
}

interface WalletTransactionListProps {
  transactions: Transaction[];
  monthLabel: string;
}

const PAGE_SIZE = 20;

/**
 * Paginated transaction list filtered to a specific wallet.
 * Shows 20 transactions at a time with a "Muat Lebih Banyak" button.
 */
export function WalletTransactionList({
  transactions,
  monthLabel,
}: WalletTransactionListProps) {
  const { data: session } = authClient.useSession();
  const { trackEvent } = useAnalytics();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [actionTx, setActionTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Record<string, unknown> | null>(null);

  const visibleTransactions = transactions.slice(0, visibleCount);
  const hasMore = visibleCount < transactions.length;

  return (
    <div>
      <SectionHeader
        title="Transaksi"
        action={{
          label: monthLabel,
          onClick: () => {
            /* TODO: Month filter */
          },
        }}
      />
      <Card className="divide-y divide-border rounded-[20px] px-4">
        {visibleTransactions.length > 0 ? (
          visibleTransactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              onClick={() => {
                setActionTx(tx);
                trackEvent("transaction_details_viewed", { source: "wallet_details" });
              }}
            />
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada transaksi
          </p>
        )}
      </Card>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              const nextCount = visibleCount + PAGE_SIZE;
              setVisibleCount(nextCount);
              trackEvent("wallet_transactions_load_more_clicked", {
                current_limit: nextCount,
              });
            }}
            className="h-10 rounded-full border-primary/40 text-sm font-medium text-primary hover:bg-primary/5"
          >
            Muat Lebih Banyak
          </Button>
        </div>
      )}

      <TransactionActionSheet
        open={!!actionTx}
        onOpenChange={(open) => {
          if (!open) setActionTx(null);
        }}
        transaction={actionTx as React.ComponentProps<typeof TransactionActionSheet>["transaction"]}
        currentUserId={session?.user?.id}
        onEdit={() => setEditTx(actionTx?.raw ?? null)}
      />

      <AddTransactionSheet
        open={!!editTx}
        onOpenChange={(open) => !open && setEditTx(null)}
        initialData={editTx}
      />
    </div>
  );
}
