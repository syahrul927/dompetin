"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
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

interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  createdBy?: { id: string; name: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onEdit: () => void;
  currentUserId?: string;
}

export function TransactionActionSheet({ open, onOpenChange, transaction, onEdit, currentUserId }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-0 pb-8 pt-0">
          <DrawerHeader className="border-b px-5 pb-3 pt-4 text-left">
            <DrawerTitle>{transaction.name}</DrawerTitle>
            <p className="text-sm text-muted-foreground">{transaction.category}</p>
          </DrawerHeader>
          <div className="flex flex-col p-4 space-y-2">
            {!isCreator ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Hanya pembuat yang dapat mengubah transaksi ini.
              </p>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-14 text-base rounded-xl"
                  onClick={() => {
                    onOpenChange(false);
                    // Add slight delay to allow drawer to close smoothly
                    setTimeout(onEdit, 150);
                  }}
                >
                  <Pencil className="mr-3 h-5 w-5" />
                  Edit Transaksi
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-14 text-base text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-3 h-5 w-5" />
                  Hapus Transaksi
                </Button>
              </>
            )}
          </div>
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
