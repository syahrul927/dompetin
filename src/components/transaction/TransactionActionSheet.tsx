"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2, Calendar, Tag, Wallet, User, FileText, DollarSign, ArrowRightLeft } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/trpc/react";
import { AmountText } from "@/components/shared/AmountText";
import { formatIDR } from "@/lib/formatIDR";

interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  feeAmount?: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  createdBy?: { id: string; name: string };
  notes?: string | null;
  wallet?: { id: string; name: string } | null;
  toWallet?: { id: string; name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onEdit: () => void;
  currentUserId?: string;
}

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}

function DetailRow({ icon: Icon, value }: DetailRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm">{value}</span>
    </div>
  );
}

interface AmountRowProps {
  amount: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
}

function AmountRow({ amount, type }: AmountRowProps) {
  return (
    <div className="py-3">
      <AmountText amount={amount} type={type} size="md" />
    </div>
  );
}

export function TransactionActionSheet({ open, onOpenChange, transaction, onEdit, currentUserId }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { trackEvent } = useAnalytics();
  const deleteTx = api.transaction.deleteTransaction.useMutation();
  const utils = api.useUtils();

  if (!transaction) return null;

  const isCreator = currentUserId === transaction.createdBy?.id;

  const handleDelete = async () => {
    try {
      await deleteTx.mutateAsync({ id: transaction.id });
      await utils.transaction.getTransactions.invalidate();
      await utils.transaction.getDashboardSummary.invalidate();
      await utils.wallet.getWallets.invalidate();
      await utils.wallet.getWallet.invalidate();
      await utils.budget.getBudgets.invalidate();
      await utils.budget.getBudget.invalidate();
      trackEvent("transaction_deleted");
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-0 pb-8 pt-0">
          <DrawerHeader className="border-b px-5 pb-3 pt-4 text-left">
            <DrawerTitle>{transaction.name}</DrawerTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{transaction.category}</span>
              {transaction.wallet && (
                <>
                  <span>·</span>
                  <span>{transaction.wallet.name}</span>
                </>
              )}
            </div>
          </DrawerHeader>

          {/* Summary Card Section */}
          <div className="flex flex-col items-center px-5 pt-4 pb-6">
            {/* Large Amount Display */}
            <AmountText amount={transaction.amount} type={transaction.type} size="lg" />

            {/* Transfer Fee (if applicable) */}
            {transaction.feeAmount && transaction.feeAmount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                + Biaya {formatIDR(transaction.feeAmount)}
              </p>
            )}

            {/* Date */}
            <p className="text-sm text-muted-foreground mt-2">{formatDate(transaction.date)}</p>

            {/* Notes Preview (if exists) */}
            {transaction.notes && (
              <div className="mt-4 w-full bg-muted/50 rounded-xl p-3">
                <p className="text-sm line-clamp-3 text-foreground/90">{transaction.notes}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!isCreator ? (
            <div className="px-5 pb-4">
              <p className="text-center text-sm text-muted-foreground">
                Hanya pembuat yang dapat mengubah transaksi ini.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 px-5 pb-5">
              <Button
                className="flex-1 h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(onEdit, 150);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-full text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive text-sm font-medium"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="w-[calc(100%-40px)] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi ini akan dihapus permanen dan saldo dompet akan disesuaikan kembali. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              disabled={deleteTx.isPending}
              className="h-12 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTx.isPending ? <Loader2 className="animate-spin" /> : "Ya, Hapus"}
            </AlertDialogAction>
            <AlertDialogCancel className="h-12 rounded-full border-none bg-muted hover:bg-muted/80 sm:mt-0">
              Batal
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
