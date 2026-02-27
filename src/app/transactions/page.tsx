"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";
import { Loader2 } from "lucide-react";
import { TransactionActionSheet } from "@/components/transaction/TransactionActionSheet";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";

const PAGE_SIZE = 20;

function formatTransactionDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatGroupDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hari Ini";
  if (d.toDateString() === yesterday.toDateString()) return "Kemarin";

  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TransactionsPage() {
  const { workspaceId } = useActiveWorkspace();
  const { data: session } = authClient.useSession();
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Sheets state
  const [actionTx, setActionTx] = useState<any>(null);
  const [editTx, setEditTx] = useState<any>(null);

  const { data, isLoading } = api.transaction.getTransactions.useQuery(
    { workspaceId, limit, offset: 0 },
    { enabled: !!workspaceId },
  );

  const transactions = data?.transactions ?? [];
  const hasMore = data?.hasMore ?? false;

  // Transform API transactions to TransactionRow format
  const transformedTransactions = transactions.map((tx) => {
    const amount = Math.abs(parseFloat(tx.amount));
    let type: "income" | "expense" | "transfer_debit" | "transfer_credit";

    if (tx.type === "transfer") {
      type = parseFloat(tx.amount) < 0 ? "transfer_debit" : "transfer_credit";
    } else {
      type = tx.type;
    }

    return {
      id: tx.id,
      name: tx.name,
      category: tx.category?.name ?? (tx.type === "transfer" ? "Transfer" : "Lainnya"),
      categoryIcon: tx.category?.icon,
      categoryColor: tx.category?.color,
      date: formatTransactionDate(tx.date),
      rawDate: new Date(tx.date),
      amount,
      type,
      authorName: tx.createdBy?.name,
      createdBy: tx.createdBy,
      raw: tx,
    };
  });

  // Group by date
  const grouped = transformedTransactions.reduce<
    Record<string, typeof transformedTransactions>
  >((acc, tx) => {
    const key = tx.rawDate.toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(tx);
    return acc;
  }, {});

  const dateKeys = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  return (
    <>
      <PageHeader title="Transaksi" />
      <div className="px-5 pt-2">
        {/* Loading state */}
        {isLoading && (
          <div className="mt-4 space-y-4">
            {[1, 2, 3].map((g) => (
              <div key={g}>
                <Skeleton className="mb-2 h-4 w-32" />
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
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && transactions.length === 0 && (
          <Card className="mt-6 rounded-[20px] p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada transaksi. Tap tombol + untuk menambahkan transaksi
              pertama Anda!
            </p>
          </Card>
        )}

        {/* Transaction list grouped by date */}
        {!isLoading && dateKeys.length > 0 && (
          <div className="mt-4 space-y-5">
            {dateKeys.map((dateKey) => {
              const txs = grouped[dateKey]!;
              return (
                <div key={dateKey}>
                  <h3 className="mb-2 text-[13px] font-semibold text-muted-foreground">
                    {formatGroupDate(dateKey)}
                  </h3>
                  <Card className="divide-y divide-border rounded-[20px] px-4">
                    {txs.map((tx) => (
                      <TransactionRow key={tx.id} transaction={tx} onClick={() => setActionTx(tx)} />
                    ))}
                  </Card>
                </div>
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-2 pb-10">
                <Button
                  variant="ghost"
                  onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                  className="text-sm font-medium text-primary"
                >
                  <Loader2
                    size={16}
                    className={`mr-2 ${isLoading ? "animate-spin" : "hidden"}`}
                  />
                  Muat Lebih Banyak
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

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
    </>
  );
}
