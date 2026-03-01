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
import { Loader2, Calendar } from "lucide-react";
import { TransactionActionSheet } from "@/components/transaction/TransactionActionSheet";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { getWalletContext } from "@/lib/transaction-helpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionAnalytics } from "@/components/transaction/TransactionAnalytics";
import { ExpenseCategoryChart } from "@/components/dashboard/ExpenseCategoryChart";

const PAGE_SIZE = 20;

const MONTHS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

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

  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Sheets state
  const [actionTx, setActionTx] = useState<Record<string, unknown> | null>(
    null,
  );
  const [editTx, setEditTx] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading: isLoadingTransactions } = api.transaction.getTransactions.useQuery(
    { workspaceId, month, year, limit, offset: 0 },
    { enabled: !!workspaceId },
  );

  const { data: analytics, isLoading: isLoadingAnalytics } = api.transaction.getTransactionAnalytics.useQuery(
    { workspaceId, month, year },
    { enabled: !!workspaceId },
  );

  const { data: categoryData, isLoading: isLoadingCategories } = api.transaction.getExpenseByCategory.useQuery(
    { workspaceId, month, year },
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
      category:
        tx.category?.name ?? (tx.type === "transfer" ? "Transfer" : "Lainnya"),
      categoryIcon: tx.category?.icon,
      categoryColor: tx.category?.color,
      date: formatTransactionDate(tx.date),
      rawDate: new Date(tx.date),
      amount,
      feeAmount: (tx as { feeAmount?: number }).feeAmount,
      type,
      walletContext: getWalletContext(tx.type, tx.wallet, tx.toWallet),
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

  const years = Array.from({ length: 6 }, (_, i) => now.getUTCFullYear() - 4 + i);

  return (
    <>
      <PageHeader title="Transaksi" />
      <div className="px-5 pt-2 pb-24">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          <Select
            value={month.toString()}
            onValueChange={(val) => setMonth(parseInt(val))}
          >
            <SelectTrigger className="h-9 rounded-full bg-secondary/50 border-none px-4 text-xs font-medium w-fit">
              <Calendar size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Bulan" />
            </SelectTrigger>
            <SelectContent className="rounded-[20px]">
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={year.toString()}
            onValueChange={(val) => setYear(parseInt(val))}
          >
            <SelectTrigger className="h-9 rounded-full bg-secondary/50 border-none px-4 text-xs font-medium w-fit">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent className="rounded-[20px]">
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Analytics Section */}
        <div className="mb-8">
          <TransactionAnalytics data={analytics} isLoading={isLoadingAnalytics} />
        </div>

        {/* Category Breakdown */}
        <div className="mb-8">
          <ExpenseCategoryChart
            categories={categoryData?.categories ?? []}
            grandTotal={categoryData?.grandTotal ?? 0}
            isLoading={isLoadingCategories}
          />
        </div>

        <div className="flex items-baseline justify-between mb-2 px-1">
          <h3 className="text-base font-bold">Riwayat Transaksi</h3>
        </div>

        {/* Loading state */}
        {isLoadingTransactions && transactions.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map((g) => (
              <div key={g}>
                <Skeleton className="mb-2 h-4 w-32" />
                <Card className="divide-border divide-y rounded-[20px] px-4">
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
        {!isLoadingTransactions && transactions.length === 0 && (
          <Card className="mt-4 rounded-[20px] p-8 text-center bg-secondary/20 border-dashed">
            <p className="text-muted-foreground text-sm">
              Tidak ada transaksi untuk periode ini.
            </p>
          </Card>
        )}

        {/* Transaction list grouped by date */}
        {!isLoadingTransactions && dateKeys.length > 0 && (
          <div className="space-y-5">
            {dateKeys.map((dateKey) => {
              const txs = grouped[dateKey]!;
              return (
                <div key={dateKey}>
                  <h3 className="text-muted-foreground mb-2 text-[12px] font-semibold flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    {formatGroupDate(dateKey)}
                  </h3>
                  <Card className="divide-border divide-y rounded-[20px] px-2 shadow-sm">
                    {txs.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        onClick={() => setActionTx(tx)}
                      />
                    ))}
                  </Card>
                </div>
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                  className="text-primary text-sm font-medium h-10 rounded-full hover:bg-primary/5"
                >
                  <Loader2
                    size={16}
                    className={`mr-2 ${isLoadingTransactions ? "animate-spin" : "hidden"}`}
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
        onOpenChange={(open) => {
          if (!open) setActionTx(null);
        }}
        transaction={
          actionTx as React.ComponentProps<
            typeof TransactionActionSheet
          >["transaction"]
        }
        currentUserId={session?.user?.id}
        onEdit={() =>
          setEditTx((actionTx?.raw as Record<string, unknown>) ?? null)
        }
      />

      <AddTransactionSheet
        open={!!editTx}
        onOpenChange={(open) => !open && setEditTx(null)}
        initialData={editTx}
      />
    </>
  );
}
