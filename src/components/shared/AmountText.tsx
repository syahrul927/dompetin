import React from "react";
import { formatIDR } from "@/lib/formatIDR";

interface AmountTextProps {
  amount: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  size?: "sm" | "md" | "lg";
  showSign?: boolean;
}

/**
 * Formats and renders an IDR amount with correct sign and color.
 * Used in transaction rows and wallet cards.
 */
export function AmountText({
  amount,
  type,
  size = "md",
  showSign = true,
}: AmountTextProps) {
  const isPositive = type === "income" || type === "transfer_credit";
  const sign = showSign ? (isPositive ? "+" : "-") : "";
  const colorClass = isPositive ? "text-primary" : "text-destructive";

  const sizeClass = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-[15px]",
  }[size];

  return (
    <span className={`${sizeClass} font-semibold ${colorClass}`}>
      {sign}
      {formatIDR(amount)}
    </span>
  );
}
