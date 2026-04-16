"use client";

import React from "react";
import { useImportMutation, type ParsedTransaction } from "./import-mutation-context";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { getCategoryIcon } from "@/lib/category-icons";
import { Check, AlertTriangle, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function getCategoryInfo(categoryKey: string) {
  const cat = DEFAULT_CATEGORIES.find((c) => c.key === categoryKey);
  return {
    name: cat?.name ?? "Lainnya",
    icon: cat?.icon ?? "tag",
    color: cat?.color ?? "#6b7280",
  };
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
  const category = getCategoryInfo(transaction.categoryKey);
  const isFallback = isLainnya(transaction.categoryKey);
  const CategoryIcon = getCategoryIcon(category.icon);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: "REMOVE_TRANSACTION", id: transaction.id });
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-all active:scale-[0.98] active:bg-muted/50",
        !valid && "border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5",
      )}
      onClick={() => onEdit(transaction)}
    >
      {/* Remove button */}
      <button
        onClick={handleRemove}
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0 shadow-sm transition-all group-hover:opacity-100 group-active:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
      >
        <X size={12} />
      </button>

      {/* Category icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${category.color}15` }}
      >
        <CategoryIcon size={18} style={{ color: category.color }} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium leading-tight truncate">
          {transaction.name || "Tanpa nama"}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[11px] font-medium",
              isFallback ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            {category.name}
          </span>
          <span className="text-[9px] text-muted-foreground/50">·</span>
          <span className="text-[11px] text-muted-foreground">
            {transaction.date
              ? new Date(transaction.date + "T00:00:00").toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                })
              : "Tanggal ?"}
          </span>
        </div>
      </div>

      {/* Amount & status */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {isIncome ? "+" : "-"}Rp {transaction.amount.toLocaleString("id-ID")}
        </span>
        {valid ? (
          <Check size={13} className="text-emerald-500" />
        ) : (
          <div className="flex items-center gap-0.5">
            <AlertTriangle size={11} className="text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Lengkapi
            </span>
          </div>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight size={16} className="shrink-0 text-muted-foreground/40" />
    </div>
  );
}
