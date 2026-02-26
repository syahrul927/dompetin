import React from "react";
import { MoreHorizontal, ArrowRightLeft } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { AmountText } from "./AmountText";

interface TransactionRowProps {
  transaction: {
    id: string;
    name: string;
    category: string;
    categoryIcon?: string;
    categoryColor?: string;
    date: string;
    amount: number;
    type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  };
  onClick?: () => void;
}

/**
 * A single transaction list item.
 * Used in Dashboard recent transactions, Wallet Detail, and transaction lists.
 */
export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const isTransfer =
    transaction.type === "transfer_debit" ||
    transaction.type === "transfer_credit";

  const Icon = isTransfer
    ? ArrowRightLeft
    : transaction.categoryIcon
      ? getCategoryIcon(transaction.categoryIcon)
      : MoreHorizontal;

  const iconBgColor = transaction.categoryColor
    ? `${transaction.categoryColor}20`
    : undefined;
  const iconColor = transaction.categoryColor ?? undefined;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-muted"
        style={
          iconBgColor && iconColor
            ? { backgroundColor: iconBgColor, color: iconColor }
            : undefined
        }
      >
        <Icon
          size={18}
          className={iconBgColor ? "" : "text-muted-foreground"}
        />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {transaction.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {transaction.category} · {transaction.date}
        </p>
      </div>
      <AmountText
        amount={transaction.amount}
        type={transaction.type}
        size="md"
      />
    </button>
  );
}
