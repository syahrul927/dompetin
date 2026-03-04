import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionActionSheet } from "@/components/transaction/TransactionActionSheet";
import { TransactionManager } from "@/components/transaction/TransactionManager";
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

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

/**
 * List of last 10 transactions across all wallets in the active workspace.
 */
export function RecentTransactions({
  transactions,
  isLoading,
}: RecentTransactionsProps) {
  const { data: session } = authClient.useSession();
  const { trackEvent } = useAnalytics();
  const [actionTx, setActionTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Record<string, unknown> | null>(null);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Transaksi Terbaru" />
        <Card className="divide-y divide-border rounded-[20px] px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="h-10 w-10 rounded-[14px]" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div>
        <SectionHeader title="Transaksi Terbaru" />
        <Card className="rounded-[20px] p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada transaksi. Mulai dengan menambahkan transaksi pertama Anda!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Transaksi Terbaru"
        action={{
          label: "Lihat Semua →",
          href: "/transactions",
          onClick: () => trackEvent("dashboard_view_all_transactions_clicked"),
        }}
      />
      <Card className="divide-y divide-border rounded-[20px] px-4">
        {transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            onClick={() => {
              setActionTx(transaction);
              trackEvent("transaction_details_viewed", { source: "dashboard" });
            }}
          />
        ))}
      </Card>

      <TransactionActionSheet
        open={!!actionTx}
        onOpenChange={(open) => {
          if (!open) setActionTx(null);
        }}
        transaction={actionTx as React.ComponentProps<typeof TransactionActionSheet>["transaction"]}
        currentUserId={session?.user?.id}
        onEdit={() => setEditTx(actionTx?.raw ?? null)}
      />

      <TransactionManager
        open={!!editTx}
        onOpenChange={(open) => !open && setEditTx(null)}
        initialData={editTx}
      />
    </div>
  );
}
