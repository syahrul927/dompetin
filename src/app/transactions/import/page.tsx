"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
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
        const parsed = JSON.parse(stored);
        dispatch({ type: "SET_TRANSACTIONS", transactions: parsed });
        sessionStorage.removeItem("importMutationData");
      } catch {
        // Invalid data, ignore
      }
    }
  }, [dispatch]);

  const transactions = state.transactions;
  const canSave = !!selectedWalletId && allValid() && !createBulk.isPending;

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
        {/* Global Wallet Selector */}
        {transactions.length > 0 && (
          <div className="mb-4">
            <WalletSelectDrawer
              value={selectedWalletId}
              onChange={setSelectedWalletId}
              workspaceId={workspaceId}
            >
              <div className={cn(
                "flex items-center gap-3 rounded-[16px] border p-3 transition-colors",
                !selectedWalletId ? "border-amber-500/50 bg-amber-500/5" : "border-border"
              )}>
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  !selectedWalletId ? "bg-amber-500/10" : "bg-muted"
                )}>
                  <Wallet size={18} className={!selectedWalletId ? "text-amber-500" : "text-muted-foreground"} />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-xs font-medium",
                    !selectedWalletId ? "text-amber-500" : "text-muted-foreground"
                  )}>
                    Sumber Dompet
                  </span>
                  <span className={cn(
                    "text-sm",
                    !selectedWalletId ? "text-amber-600 font-medium" : "font-medium"
                  )}>
                    {selectedWalletName || "Pilih dompet sumber"}
                  </span>
                </div>
              </div>
            </WalletSelectDrawer>
          </div>
        )}

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
