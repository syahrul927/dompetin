import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionActionSheet } from "@/components/transaction/TransactionActionSheet";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { authClient } from "@/server/better-auth/client";

interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  authorName?: string;
  createdBy?: any;
  raw?: any;
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
  const [actionTx, setActionTx] = useState<any>(null);
  const [editTx, setEditTx] = useState<any>(null);

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
        action={{ label: "Lihat Semua →", href: "/transactions" }}
      />
      <Card className="divide-y divide-border rounded-[20px] px-4">
        {transactions.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} onClick={() => setActionTx(transaction)} />
        ))}
      </Card>

      <TransactionActionSheet
        open={!!actionTx}
        onOpenChange={(open) => !open && setActionTx(null)}
        transaction={actionTx}
        currentUserId={session?.user?.id}
        onEdit={() => setEditTx(actionTx?.raw)}
      />

      <AddTransactionSheet
        open={!!editTx}
        onOpenChange={(open) => !open && setEditTx(null)}
        initialData={editTx}
      />
    </div>
  );
}
