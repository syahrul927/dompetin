"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ImportMutationCard } from "@/components/import-mutation/import-mutation-card";
import {
  useImportMutation,
  type ParsedTransaction,
} from "@/components/import-mutation/import-mutation-context";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export default function ImportMutationPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const { state, dispatch, allValid } = useImportMutation();
  const [editingItem, setEditingItem] = useState<ParsedTransaction | null>(null);

  const createBulk = api.transaction.createBulkTransactions.useMutation();
  const utils = api.useUtils();

  // Load parsed transactions from sessionStorage (set by TransactionManager)
  useEffect(() => {
    const stored = sessionStorage.getItem("importMutationData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        dispatch({ type: "SET_TRANSACTIONS", transactions: parsed });
        sessionStorage.removeItem("importMutationData");
      } catch {
        // Invalid data, ignore
      }
    }
  }, [dispatch]);

  const transactions = state.transactions;
  const canSave = allValid() && !createBulk.isPending;

  const handleEdit = (item: ParsedTransaction) => {
    setEditingItem(item);
  };

  const handleDrawerSave = (updatedData: Record<string, unknown>) => {
    if (!editingItem) return;

    dispatch({
      type: "UPDATE_TRANSACTION",
      id: editingItem.id,
      data: {
        name: (updatedData.name as string) || editingItem.name,
        amount: Number(updatedData.amount) || editingItem.amount,
        type: (updatedData.type as "income" | "expense") || editingItem.type,
        date: (updatedData.date as string) || editingItem.date,
        notes: (updatedData.notes as string) ?? editingItem.notes,
        walletId: (updatedData.wallet as { id: string })?.id || (updatedData.walletId as string | undefined),
        categoryId: (updatedData.category as { id: string })?.id || (updatedData.categoryId as string | undefined),
      },
    });
    setEditingItem(null);
  };

  const handleSaveAll = async () => {
    if (!canSave || !workspaceId) return;

    const bulkInput = transactions.map((t) => ({
      type: t.type,
      amount: t.amount * 100, // Convert to cents
      name: t.name.trim(),
      notes: t.notes || undefined,
      date: new Date(t.date + "T00:00:00Z").toISOString(),
      walletId: t.walletId!,
      categoryId: t.categoryId!,
    }));

    try {
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
        wallet: editingItem.walletId ? { id: editingItem.walletId } : null,
        category: editingItem.categoryId ? { id: editingItem.categoryId } : null,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-5 py-4">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors active:bg-muted"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <h1 className="text-lg font-semibold">Impor Mutasi</h1>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-white">
            {transactions.length}
          </span>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-28">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <span className="text-sm">Tidak ada transaksi untuk diimpor</span>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="mt-2 rounded-full"
            >
              Kembali
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <ImportMutationCard
                key={t.id}
                transaction={t}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      {transactions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background px-5 py-4">
          <div className="mx-auto max-w-lg">
            <Button
              onClick={handleSaveAll}
              className="h-12 w-full rounded-full bg-primary text-base font-semibold text-white hover:bg-primary"
              disabled={!canSave}
            >
              {createBulk.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                `Simpan Semua (${transactions.length})`
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
