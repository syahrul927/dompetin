"use client";

import React, { useState } from "react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
            <TransactionRow key={tx.id} transaction={tx} />
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
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="h-10 rounded-full border-primary/40 text-sm font-medium text-primary hover:bg-primary/5"
          >
            Muat Lebih Banyak
          </Button>
        </div>
      )}
    </div>
  );
}
