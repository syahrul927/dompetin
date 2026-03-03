"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AmountInput } from "@/components/transaction/AmountInput";
import { Numpad } from "@/components/shared/Numpad";
import { api } from "@/trpc/react";
import { Loader2 } from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function CreateBudgetDrawer({ open, onOpenChange, workspaceId }: Props) {
  const [step, setStep] = useState<"amount" | "details">("amount");
  const [amountStr, setAmountStr] = useState("0");
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const { trackEvent } = useAnalytics();

  const utils = api.useUtils();
  const createBudget = api.budget.createBudget.useMutation();

  const amount = parseInt(amountStr, 10) || 0;
  const canSubmit = amount > 0 && name.trim().length > 0;

  const resetForm = () => {
    setStep("amount");
    setAmountStr("0");
    setName("");
    setPeriod("monthly");
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await createBudget.mutateAsync({
        workspaceId,
        amount: amount * 100,
        name: name.trim(),
        period,
        icon: "💰", // Hardcoded for V1 speed
        color: "#3b82f6" // Hardcoded for V1 speed
      });

      await utils.budget.getBudgets.invalidate();
      trackEvent("budget_created");
      resetForm();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DrawerContent className="max-h-[95dvh] px-0 pb-0 pt-0">
        <DrawerHeader className="border-b px-5 pb-3 pt-4">
          <DrawerTitle>{step === "amount" ? "Buat Anggaran" : "Detail Anggaran"}</DrawerTitle>
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
                Lanjut
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <span className="text-sm text-muted-foreground">Batas Anggaran</span>
              <button type="button" onClick={() => setStep("amount")} className="text-lg font-bold">
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

              <div className="space-y-2 pt-2">
                <Label>Periode</Label>
                <Select value={period} onValueChange={(v: "daily" | "weekly" | "monthly" | "yearly") => setPeriod(v)}>
                  <SelectTrigger className="h-12 rounded-2xl">
                    <SelectValue placeholder="Pilih periode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Harian</SelectItem>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                    <SelectItem value="yearly">Tahunan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t px-5 pb-8 pt-3">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createBudget.isPending}
                className="h-12 w-full rounded-full bg-primary font-semibold text-white"
              >
                {createBudget.isPending ? <Loader2 className="animate-spin" /> : "Simpan Anggaran"}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}