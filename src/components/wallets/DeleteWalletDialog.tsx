"use client";

import React from "react";
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
import { formatIDR } from "@/lib/formatIDR";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useAnalytics } from "@/hooks/use-analytics";

interface DeleteWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: {
    id: string;
    name: string;
    balance: string;
  } | null;
}

export function DeleteWalletDialog({
  open,
  onOpenChange,
  wallet,
}: DeleteWalletDialogProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { trackEvent } = useAnalytics();

  const deleteMutation = api.wallet.deleteWallet.useMutation({
    onSuccess: () => {
      void utils.wallet.getWallets.invalidate();
      trackEvent("wallet_deleted");
      onOpenChange(false);
      router.push("/wallets");
    },
  });

  const handleDelete = () => {
    if (!wallet) return;
    deleteMutation.mutate({ id: wallet.id });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[20px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Arsipkan Dompet?</AlertDialogTitle>
          <AlertDialogDescription>
            Dompet <strong>{wallet?.name}</strong> dengan saldo{" "}
            <strong>{formatIDR(parseFloat(wallet?.balance ?? "0"))}</strong> akan
            diarsipkan. Dompet yang diarsipkan tidak akan tampil di daftar
            utama.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Mengarsipkan..." : "Arsipkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
