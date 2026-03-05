"use client";

import React, { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TypeToggle } from "./TypeToggle";
import { AmountInput } from "./AmountInput";
import { FormRow } from "@/components/shared/FormRow";
import { Numpad } from "@/components/shared/Numpad";
import { WalletSelectDrawer } from "./WalletSelectDrawer";
import { BudgetSelectDrawer } from "./BudgetSelectDrawer";
import { CategorySelectDrawer } from "./CategorySelectDrawer";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { useAnalytics } from "@/hooks/use-analytics";
import { isDefaultCategoryId } from "@/lib/default-categories";
import { ArrowDown, ArrowLeft, Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Record<string, unknown> | null; // The full transaction object from DB
}

export function AddTransactionSheet({
  open,
  onOpenChange,
  initialData,
}: AddTransactionSheetProps) {
  const { workspaceId } = useActiveWorkspace();
  const { trackEvent } = useAnalytics();

  // Step state: "amount" or "details"
  const [step, setStep] = useState<"amount" | "details">("amount");

  // Form state
  const [type, setType] = useState<"income" | "expense" | "transfer">(
    "expense",
  );
  const [amountStr, setAmountStr] = useState("0");
  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState("");
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [note, setNote] = useState("");
  const [hasFee, setHasFee] = useState(false);
  const [feeAmountStr, setFeeAmountStr] = useState("0");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea based on its scrollHeight whenever `note` changes
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [note]);

  // Queries for display names
  const { data: wallets } = api.wallet.getWallets.useQuery(
    { workspaceId },
    { enabled: open && !!workspaceId },
  );

  const { data: categories } = api.category.getCategories.useQuery(
    { workspaceId, type: type as "income" | "expense" },
    { enabled: open && !!workspaceId && type !== "transfer" },
  );

  const { data: budgets } = api.budget.getBudgets.useQuery(
    { workspaceId, isActive: true },
    { enabled: open && !!workspaceId && type === "expense" },
  );

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setStep("details");

        let txType = initialData.type as "income" | "expense" | "transfer" | "transfer_debit" | "transfer_credit";
        if (txType === "transfer_debit" || txType === "transfer_credit") txType = "transfer";

        setType(txType);
        setAmountStr(Math.abs(Number(initialData.amount) || 0).toString());
        setName((initialData.name as string) || "");
        const dateStr = initialData.date ? new Date(initialData.date as string) : new Date();
        setDate(`${dateStr.getFullYear()}-${String(dateStr.getMonth() + 1).padStart(2, "0")}-${String(dateStr.getDate()).padStart(2, "0")}`);
        setNote((initialData.notes as string) || "");

        // Handle transfer fee in edit mode
        if (txType === "transfer" && (initialData as { feeAmount?: number }).feeAmount) {
          setHasFee(true);
          setFeeAmountStr((initialData as { feeAmount: number }).feeAmount.toString());
        } else {
          setHasFee(false);
          setFeeAmountStr("0");
        }

        if (txType !== "transfer") {
          setWalletId((initialData.wallet as { id: string })?.id || "");
          setCategoryId((initialData.category as { id: string })?.id || "");
        } else {
          setFromWalletId((initialData.wallet as { id: string })?.id || "");
          setToWalletId((initialData.toWallet as { id: string })?.id || "");
        }
        if (txType === "expense") {
          setBudgetId((initialData.budget as { id: string })?.id || "");
        }
      } else {
        resetForm();
      }
    }
  }, [open, initialData]);

  // Mutations
  const createTransaction = api.transaction.createTransaction.useMutation();
  const createTransfer = api.transaction.createTransfer.useMutation();
  const updateTransaction = api.transaction.updateTransaction.useMutation();
  const resolveCategory = api.category.resolveCategory.useMutation();
  const utils = api.useUtils();

  // Derived
  const amount = parseInt(amountStr, 10) || 0;
  const selectedWalletName = wallets?.find((w) => w.id === walletId)?.name;
  const selectedFromWalletName = wallets?.find(
    (w) => w.id === fromWalletId,
  )?.name;
  const selectedToWalletName = wallets?.find(
    (w) => w.id === toWalletId,
  )?.name;
  const selectedCategoryName = categories?.find(
    (c) => c.id === categoryId,
  )?.name;

  const selectedBudgetName = budgets?.find(
    (b) => b.id === budgetId,
  )?.name;

  const [isLocked, setIsLocked] = useState(false);

  const isSubmitting =
    createTransaction.isPending ||
    createTransfer.isPending ||
    updateTransaction.isPending ||
    resolveCategory.isPending;

  const canSubmit =
    amount > 0 &&
    (name || "").trim().length > 0 &&
    (type === "transfer"
      ? !!fromWalletId && !!toWalletId && fromWalletId !== toWalletId
      : !!walletId);

  const resetForm = () => {
    setStep("amount");
    setType("expense");
    setAmountStr("0");
    setName("");
    setWalletId("");
    setFromWalletId("");
    setToWalletId("");
    setCategoryId("");
    setBudgetId("");
    setDate(new Date().toISOString().split("T")[0]!);
    setNote("");
    setHasFee(false);
    setFeeAmountStr("0");
    setIsLocked(false);
  };

  const handleTypeChange = (newType: "income" | "expense" | "transfer") => {
    setType(newType);
    setCategoryId("");
    if (newType === "transfer") {
      setWalletId("");
    } else {
      setFromWalletId("");
      setToWalletId("");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || isLocked) return;

    setIsLocked(true);

    const amountInCents = amount * 100;
    const dateISO = new Date(date + "T00:00:00Z").toISOString();

    try {
      if (initialData && initialData.id) {
        // Edit mode
        let resolvedCategoryId = categoryId || undefined;
        if (categoryId && isDefaultCategoryId(categoryId)) {
          const result = await resolveCategory.mutateAsync({
            categoryId,
            workspaceId,
          });
          resolvedCategoryId = result.id;
        }

        const updateDataPayload = {
          id: initialData.id as string,
          name: (name || "").trim(),
          notes: (note || "").trim() || undefined,
          date: dateISO,
          amount: amountInCents,
        };

        if (type !== "transfer") {
          await updateTransaction.mutateAsync({
            ...updateDataPayload,
            walletId,
            categoryId: resolvedCategoryId,
            budgetId: budgetId || undefined,
          });
        } else {
          const feeAmountInCents = hasFee ? (parseInt(feeAmountStr, 10) || 0) * 100 : 0;
          await updateTransaction.mutateAsync({
            ...updateDataPayload,
            walletId: fromWalletId,
            toWalletId: toWalletId,
            feeAmount: feeAmountInCents,
          });
        }
      } else {
        // Create mode
        let resolvedCategoryId = categoryId || undefined;
        if (categoryId && isDefaultCategoryId(categoryId)) {
          const result = await resolveCategory.mutateAsync({
            categoryId,
            workspaceId,
          });
          resolvedCategoryId = result.id;
        }

        if (type === "transfer") {
          const feeAmountInCents = hasFee ? (parseInt(feeAmountStr, 10) || 0) * 100 : undefined;
          await createTransfer.mutateAsync({
            fromWalletId,
            toWalletId,
            amount: amountInCents,
            feeAmount: feeAmountInCents,
            name: (name || "").trim(),
            notes: (note || "").trim() || undefined,
            date: dateISO,
          });
        } else {
          await createTransaction.mutateAsync({
            type,
            amount: amountInCents,
            name: (name || "").trim(),
            notes: (note || "").trim() || undefined,
            date: dateISO,
            walletId,
            categoryId: resolvedCategoryId,
            budgetId: budgetId || undefined,
          });
        }
      }

      await Promise.all([
        utils.transaction.getTransactions.invalidate(),
        utils.transaction.getDashboardSummary.invalidate(),
        utils.wallet.getWallets.invalidate(),
        utils.wallet.getWallet.invalidate(),
        utils.budget.getBudgets.invalidate(),
        utils.budget.getBudget.invalidate(),
      ]);

      trackEvent(initialData?.id ? "transaction_updated" : "transaction_added", {
        type,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create transaction:", error);
    } finally {
      setIsLocked(false);
    }
  };

  /** Dismiss soft keyboard on Enter key */
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DrawerContent className="max-h-[95dvh] rounded-t-[28px] px-0 pb-0 pt-0">
        {/* Header */}
        <DrawerHeader className="border-b px-5 pb-3">
          <div className="flex items-center gap-3">
            {step === "details" && (
              <button
                type="button"
                onClick={() => setStep("amount")}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors active:bg-muted"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <DrawerTitle>
              {step === "amount" ? "Tambah Transaksi" : "Detail Transaksi"}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        {step === "amount" ? (
          /* ============ STEP 1: Amount Entry ============ */
          <div className="flex flex-col relative h-[calc(100vh-120px)] sm:h-auto">
            {/* Type Toggle */}
            <div className="px-5 pt-4">
              <TypeToggle value={type} onChange={handleTypeChange} disabled={!!initialData} />
            </div>

            {/* Amount Display */}
            <AmountInput value={amount} />

            {/* Numpad */}
            <div className="px-5 pb-2 pt-1">
              <Numpad value={amountStr} onChange={setAmountStr} />
            </div>

            {/* Continue Button */}
            <div className="px-5 pb-8 pt-2 mt-auto">
              <Button
                onClick={() => setStep("details")}
                className="h-12 w-full rounded-full bg-primary text-base font-semibold text-white hover:bg-primary"
                disabled={amount === 0}
              >
                Lanjut
              </Button>
            </div>
          </div>
        ) : (
          /* ============ STEP 2: Detail Fields ============ */
          <div className="flex flex-col h-[calc(100vh-120px)] sm:h-auto">
            {/* Amount Summary (compact) */}
            <div className="flex items-center justify-between border-b px-5 py-3 shrink-0">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Jumlah</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    type === "expense" ? "bg-red-500/10 text-red-500" :
                    type === "income" ? "bg-emerald-500/10 text-emerald-500" :
                    "bg-blue-500/10 text-blue-500"
                  )}>
                    {type === "expense" ? "Pengeluaran" : type === "income" ? "Pemasukan" : "Transfer"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep("amount")}
                className={cn(
                  "text-xl font-bold tracking-tight",
                  type === "expense" ? "text-red-500" :
                  type === "income" ? "text-emerald-500" :
                  "text-blue-500"
                )}
              >
                {type === "expense" ? "- " : type === "income" ? "+ " : ""}Rp {amount.toLocaleString("id-ID")}
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-12">
              <div className="space-y-3">
                {/* Name */}
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Nama transaksi"
                  enterKeyHint="done"
                  className="h-12 rounded-2xl border-border"
                />

                {/* Wallet / Transfer */}
                {type === "transfer" ? (
                  <div className="flex flex-col gap-0">
                    <WalletSelectDrawer
                      value={fromWalletId}
                      onChange={setFromWalletId}
                      workspaceId={workspaceId}
                    >
                      <FormRow
                        label="Dari Dompet"
                        value={selectedFromWalletName}
                        placeholder="Pilih dompet"
                      />
                    </WalletSelectDrawer>
                    <div className="flex justify-center py-1">
                      <ArrowDown size={18} className="text-muted-foreground" />
                    </div>
                    <WalletSelectDrawer
                      value={toWalletId}
                      onChange={setToWalletId}
                      workspaceId={workspaceId}
                    >
                      <FormRow
                        label="Ke Dompet"
                        value={selectedToWalletName}
                        placeholder="Pilih dompet"
                      />
                    </WalletSelectDrawer>
                  </div>
                ) : (
                  <WalletSelectDrawer
                    value={walletId}
                    onChange={setWalletId}
                    workspaceId={workspaceId}
                  >
                    <FormRow
                      label="Dompet"
                      value={selectedWalletName}
                      placeholder="Pilih dompet"
                    />
                  </WalletSelectDrawer>
                )}

                {/* Category (not for transfer) */}
                {type !== "transfer" && (
                  <>
                    <CategorySelectDrawer
                      value={categoryId}
                      type={type}
                      onChange={setCategoryId}
                      workspaceId={workspaceId}
                    >
                      <FormRow
                        label="Kategori"
                        value={selectedCategoryName}
                        placeholder="Pilih kategori"
                      />
                    </CategorySelectDrawer>

                    {type === "expense" && (
                      <BudgetSelectDrawer
                        value={budgetId}
                        onChange={setBudgetId}
                        workspaceId={workspaceId}
                      >
                        <FormRow
                          label="Anggaran"
                          value={selectedBudgetName}
                          placeholder="Pilih anggaran (Opsional)"
                        />
                      </BudgetSelectDrawer>
                    )}
                  </>
                )}

                {/* Date */}
                <div className="space-y-1.5">
                  <span className="pl-1 text-xs font-medium text-muted-foreground">Tanggal</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "flex h-12 w-full items-center justify-start rounded-2xl border-border bg-muted/50 px-4 text-left text-sm font-medium hover:bg-muted/80",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-3 h-4 w-4 opacity-50" />
                        {date ? (
                          format(new Date(date), "dd MMMM yyyy", { locale: idLocale })
                        ) : (
                          <span>Pilih tanggal</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(date)}
                        onSelect={(newDate) => {
                          if (newDate) {
                            // Adjust for local timezone before converting to string
                            const adjustedDate = new Date(newDate.getTime() - newDate.getTimezoneOffset() * 60000);
                            setDate(adjustedDate.toISOString().split("T")[0]!);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Transfer Fee Toggle */}
                {type === "transfer" && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between px-1">
                      <Label htmlFor="has-fee" className="text-sm font-medium">Biaya Transfer</Label>
                      <Switch
                        id="has-fee"
                        checked={hasFee}
                        onCheckedChange={setHasFee}
                      />
                    </div>
                    {hasFee && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={feeAmountStr === "0" ? "" : feeAmountStr}
                          onChange={(e) => setFeeAmountStr(e.target.value.replace(/[^0-9]/g, ""))}
                          onKeyDown={handleInputKeyDown}
                          placeholder="Masukkan biaya admin"
                          className="h-12 rounded-2xl border-border"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Note */}
                <Textarea
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan (opsional)"
                  className="min-h-24 rounded-2xl border-border resize-none overflow-hidden"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="border-t px-5 pb-8 pt-3 shrink-0 bg-background sticky bottom-0 z-10">
              <Button
                onClick={handleSubmit}
                className="h-12 w-full rounded-full bg-primary text-base font-semibold text-white hover:bg-primary"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  "Simpan Transaksi"
                )}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
