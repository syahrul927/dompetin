"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { useImportMutation, type ParsedTransaction } from "./import-mutation-context";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { ArrowUpCircle, ArrowDownCircle, Check, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

function getCategoryName(categoryKey: string): string {
  const cat = DEFAULT_CATEGORIES.find((c) => c.key === categoryKey);
  return cat?.name ?? "Lainnya";
}

function isLainnya(categoryKey: string): boolean {
  return categoryKey === "lainnya-expense" || categoryKey === "lainnya-income";
}

interface ImportMutationCardProps {
  transaction: ParsedTransaction;
  onEdit: (transaction: ParsedTransaction) => void;
}

export function ImportMutationCard({ transaction, onEdit }: ImportMutationCardProps) {
  const { isValid, dispatch } = useImportMutation();
  const valid = isValid(transaction);
  const isIncome = transaction.type === "income";
  const categoryName = getCategoryName(transaction.categoryKey);
  const isFallback = isLainnya(transaction.categoryKey);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: "REMOVE_TRANSACTION", id: transaction.id });
  };

  return (
    <Card
      className={cn(
        "relative cursor-pointer rounded-[20px] border p-4 transition-colors active:bg-muted/50",
        isIncome ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500"
      )}
      onClick={() => onEdit(transaction)}
    >
      <button
        onClick={handleRemove}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:bg-muted/80"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isIncome ? "bg-emerald-500/10" : "bg-red-500/10"
        )}>
          {isIncome ? (
            <ArrowDownCircle size={18} className="text-emerald-500" />
          ) : (
            <ArrowUpCircle size={18} className="text-red-500" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium leading-tight line-clamp-1">
            {transaction.name || "Tanpa nama"}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {transaction.date
                ? format(new Date(transaction.date + "T00:00:00"), "dd MMM yyyy", { locale: idLocale })
                : "Tanggal tidak diketahui"}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className={cn(
              "text-[10px] font-medium",
              isFallback ? "text-amber-500" : "text-muted-foreground"
            )}>
              {categoryName}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={cn(
            "text-sm font-semibold",
            isIncome ? "text-emerald-500" : "text-red-500"
          )}>
            {isIncome ? "+" : "-"}Rp {(transaction.amount).toLocaleString("id-ID")}
          </span>
          {valid ? (
            <Check size={14} className="text-emerald-500" />
          ) : (
            <div className="flex items-center gap-0.5">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] text-amber-500">Lengkapi</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
