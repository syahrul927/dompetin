"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { ArrowUpCircle, ArrowDownCircle, Loader2, Wallet, SaveAll } from "lucide-react";
import { ImportMutationCard } from "@/components/import-mutation/import-mutation-card";
import {
  useImportMutation,
  type ParsedTransaction,
} from "@/components/import-mutation/import-mutation-context";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { WalletSelectDrawer } from "@/components/transaction/WalletSelectDrawer";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ImportMutationPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const { state, dispatch, allValid } = useImportMutation();
  const [editingItem, setEditingItem] = useState<ParsedTransaction | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState("");

  const createBulk = api.transaction.createBulkTransactions.useMutation();
  const resolveCategory = api.category.resolveCategory.useMutation();
  const utils = api.useUtils();

  // Fetch wallets for display name
  const { data: wallets } = api.wallet.getWallets.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const selectedWalletName = wallets?.find((w) => w.id === selectedWalletId)?.name;

  // Load parsed transactions from sessionStorage (set by TransactionManager)
  useEffect(() => {
    const stored = sessionStorage.getItem("importMutationData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ParsedTransaction[];
        // Normalize: AI may return negative amounts for expenses
        const normalized: ParsedTransaction[] = parsed.map((t) => ({
          ...t,
          amount: Math.abs(Number(t.amount)) || 0,
        }));
        dispatch({ type: "SET_TRANSACTIONS", transactions: normalized });
        sessionStorage.removeItem("importMutationData");
      } catch {
        // Invalid data, ignore
      }
    }
  }, [dispatch]);

  const transactions = state.transactions;
  const canSave = !!selectedWalletId && allValid() && !createBulk.isPending;

  // Summary stats
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, count: transactions.length };
  }, [transactions]);

  // Count invalid items
  const invalidCount = useMemo(
    () => transactions.filter((t) => !t.categoryKey || t.amount <= 0 || !t.name.trim()).length,
    [transactions],
  );

  const handleEdit = (item: ParsedTransaction) => {
    setEditingItem(item);
  };

  const handleDrawerSave = (updatedData: Record<string, unknown>) => {
    if (!editingItem) return;

    // Extract categoryKey from the categoryId returned by AddTransactionSheet
    const categoryId = updatedData.categoryId as string | undefined;
    const categoryKey = categoryId?.startsWith("default:")
      ? categoryId.replace("default:", "")
      : editingItem.categoryKey;

    dispatch({
      type: "UPDATE_TRANSACTION",
      id: editingItem.id,
      data: {
        name: (updatedData.name as string) || editingItem.name,
        amount: Number(updatedData.amount) || editingItem.amount,
        type: (updatedData.type as "income" | "expense") || editingItem.type,
        date: (updatedData.date as string) || editingItem.date,
        notes: (updatedData.notes as string) ?? editingItem.notes,
        categoryKey,
      },
    });
    setEditingItem(null);
  };

  const handleSaveAll = async () => {
    if (!canSave || !workspaceId) return;

    try {
      // Resolve all unique categoryKeys to real DB categoryIds
      const uniqueKeys = [...new Set(transactions.map((t) => t.categoryKey))];
      const categoryMap = new Map<string, string>();

      for (const key of uniqueKeys) {
        const prefixedId = `default:${key}`;
        const resolved = await resolveCategory.mutateAsync({
          categoryId: prefixedId,
          workspaceId,
        });
        categoryMap.set(key, resolved.id);
      }

      // Build bulk input
      const bulkInput = transactions.map((t) => ({
        type: t.type,
        amount: t.amount * 100, // Convert to cents
        name: t.name.trim(),
        notes: t.notes || undefined,
        date: new Date(t.date + "T00:00:00Z").toISOString(),
        walletId: selectedWalletId,
        categoryId: categoryMap.get(t.categoryKey)!,
      }));

      const result = await createBulk.mutateAsync({
        transactions: bulkInput,
        workspaceId,
      });

      await Promise.all([
        utils.transaction.getTransactions.invalidate(),
        utils.transaction.getDashboardSummary.invalidate(),
        utils.wallet.getWallets.invalidate(),
        utils.wallet.getWallet.invalidate(),
      ]);

      toast.success(`${result.count} transaksi berhasil disimpan`);
      router.push("/transactions");
    } catch (error) {
      console.error("Bulk save error:", error);
      toast.error("Gagal menyimpan transaksi");
    }
  };

  // Map editing item to AddTransactionSheet initialData format
  const drawerInitialData = editingItem
    ? {
        ...editingItem,
        wallet: selectedWalletId ? { id: selectedWalletId } : null,
        category: editingItem.categoryKey
          ? { id: `default:${editingItem.categoryKey}` }
          : null,
      }
    : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <PageHeader
        title="Impor Mutasi"
        variant="back"
        onBack={() => router.back()}
        rightSlot={
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-[12px] font-bold text-white">
            {transactions.length}
          </span>
        }
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-36">
        {transactions.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <SaveAll size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Tidak ada transaksi</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Data hasil scan tidak ditemukan
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="mt-3 rounded-full px-6"
            >
              Kembali
            </Button>
          </div>
        ) : (
          <>
            {/* Wallet Selector */}
            <WalletSelectDrawer
              value={selectedWalletId}
              onChange={setSelectedWalletId}
              workspaceId={workspaceId}
            >
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 p-3.5 transition-all active:scale-[0.98]",
                  !selectedWalletId
                    ? "border-amber-500/40 bg-amber-50 dark:bg-amber-500/5"
                    : "border-border bg-card",
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    !selectedWalletId ? "bg-amber-500/10" : "bg-muted",
                  )}
                >
                  <Wallet
                    size={20}
                    className={!selectedWalletId ? "text-amber-500" : "text-muted-foreground"}
                  />
                </div>
                <div className="flex flex-1 flex-col">
                  <span
                    className={cn(
                      "text-[11px] font-medium uppercase tracking-wide",
                      !selectedWalletId ? "text-amber-600" : "text-muted-foreground",
                    )}
                  >
                    Sumber Dompet
                  </span>
                  <span
                    className={cn(
                      "text-sm leading-tight",
                      !selectedWalletId ? "font-semibold text-amber-700 dark:text-amber-500" : "font-medium text-foreground",
                    )}
                  >
                    {selectedWalletName || "Pilih dompet sumber"}
                  </span>
                </div>
                {!selectedWalletId && (
                  <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white">
                    Wajib
                  </span>
                )}
              </div>
            </WalletSelectDrawer>

            {/* Summary Stats */}
            <div className="mt-4 flex gap-3">
              <div className="flex flex-1 items-center gap-2.5 rounded-2xl bg-emerald-500/8 dark:bg-emerald-500/10 px-3.5 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <ArrowDownCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Pemasukan
                  </span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    Rp {summary.income.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-2.5 rounded-2xl bg-red-500/8 dark:bg-red-500/10 px-3.5 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                  <ArrowUpCircle size={16} className="text-red-600 dark:text-red-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
                    Pengeluaran
                  </span>
                  <span className="text-sm font-bold text-red-700 dark:text-red-300">
                    Rp {summary.expense.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>

            {/* Invalid Items Warning */}
            {invalidCount > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2">
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {invalidCount} transaksi perlu dilengkapi
                </span>
              </div>
            )}

            {/* Transaction List */}
            <div className="mt-5 space-y-2.5">
              {transactions.map((t) => (
                <ImportMutationCard
                  key={t.id}
                  transaction={t}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      {transactions.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-lg px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-lg">
            {/* Status line */}
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] text-muted-foreground">
                {allValid() ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Semua transaksi valid</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{invalidCount} belum lengkap</span>
                )}
              </span>
              {!selectedWalletId && (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Pilih dompet dulu
                </span>
              )}
            </div>
            <Button
              onClick={handleSaveAll}
              className="h-12 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all"
              disabled={!canSave}
            >
              {createBulk.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  <span>Menyimpan...</span>
                </div>
              ) : (
                <span>Simpan Semua ({transactions.length})</span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Edit Drawer */}
      <AddTransactionSheet
        open={!!editingItem}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingItem(null);
        }}
        initialData={drawerInitialData}
        onSave={handleDrawerSave}
      />
    </div>
  );
}
