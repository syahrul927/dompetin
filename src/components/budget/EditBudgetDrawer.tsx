"use client";

import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/transaction/AmountInput";
import { Numpad } from "@/components/shared/Numpad";
import { api } from "@/trpc/react";
import { Loader2, Trash2 } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
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

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget;
}

export function EditBudgetDrawer({ open, onOpenChange, budget }: Props) {
  const [step, setStep] = useState<"amount" | "details">("details");
  const [amountStr, setAmountStr] = useState(budget.amount.toString());
  const [name, setName] = useState(budget.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const utils = api.useUtils();
  const updateBudget = api.budget.updateBudget.useMutation();
  const deleteBudget = api.budget.deleteBudget.useMutation();

  const amount = parseInt(amountStr, 10) || 0;
  const canSubmit = amount > 0 && name.trim().length > 0;

  // Reset form when budget changes or drawer opens
  useEffect(() => {
    if (open) {
      setAmountStr(budget.amount.toString());
      setName(budget.name);
      setStep("details");
      setShowDeleteConfirm(false);
    }
  }, [open, budget]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await updateBudget.mutateAsync({
        id: budget.id,
        amount,
        name: name.trim(),
      });

      await utils.budget.getBudgets.invalidate();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBudget.mutateAsync({ id: budget.id });
      await utils.budget.getBudgets.invalidate();
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  const Icon = getCategoryIcon(budget.categoryIcon);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95dvh] px-0 pb-0 pt-0">
          <DrawerHeader className="border-b px-5 pb-3 pt-4 flex items-center justify-between">
            <DrawerTitle>{step === "amount" ? "Edit Nominal Anggaran" : "Edit Anggaran"}</DrawerTitle>
            {step === "details" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={18} />
              </Button>
            )}
          </DrawerHeader>

          {step === "amount" ? (
            <div className="flex flex-1 flex-col">
              <div className="py-6">
                <AmountInput value={amount} />
              </div>
              <div className="px-5 pb-2 pt-1">
                <Numpad value={amountStr} onChange={setAmountStr} />
              </div>
              <div className="px-5 pb-8 pt-2">
                <Button
                  onClick={() => setStep("details")}
                  className="h-12 w-full rounded-full bg-primary font-semibold text-white"
                  disabled={amount === 0}
                >
                  Selesai
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <span className="text-sm font-medium text-muted-foreground">Kategori</span>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-opacity-20"
                    style={{ backgroundColor: `${budget.categoryColor}20`, color: budget.categoryColor }}
                  >
                    <Icon size={14} />
                  </div>
                  <span className="text-sm font-semibold">{budget.categoryName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-b px-5 py-4">
                <span className="text-sm font-medium text-muted-foreground">Batas Anggaran</span>
                <button type="button" onClick={() => setStep("amount")} className="text-lg font-bold text-primary">
                  Rp {amount.toLocaleString("id-ID")}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
                <div className="space-y-2">
                  <Label>Nama Anggaran</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Makan Siang"
                    className="h-12 rounded-2xl"
                  />
                </div>
              </div>

              <div className="border-t px-5 pb-8 pt-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || updateBudget.isPending}
                  className="h-12 w-full rounded-full bg-primary font-semibold text-white"
                >
                  {updateBudget.isPending ? <Loader2 className="animate-spin" /> : "Simpan Perubahan"}
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="w-[calc(100%-40px)] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Anggaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Anggaran ini akan dihapus. Data transaksi yang sudah ada tidak akan terpengaruh. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleteBudget.isPending}
              className="h-12 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBudget.isPending ? "Menghapus..." : "Ya, Hapus"}
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