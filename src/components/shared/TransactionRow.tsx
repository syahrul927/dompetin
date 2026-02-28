import React from "react";
import { ArrowRightLeft } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { AmountText } from "./AmountText";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";

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
    authorName?: string;
    walletContext?: string;
  };
  onClick?: () => void;
}

/**
 * A single transaction list item.
 * Uses shadcn Item components for consistent layout.
 */
export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const isTransfer =
    transaction.type === "transfer_debit" ||
    transaction.type === "transfer_credit";

  const Icon = isTransfer
    ? ArrowRightLeft
    : transaction.categoryIcon
      ? getCategoryIcon(transaction.categoryIcon)
      : getCategoryIcon("tag");

  const iconBgColor = transaction.categoryColor
    ? `${transaction.categoryColor}20`
    : undefined;
  const iconColor = transaction.categoryColor ?? undefined;

  // First word only for author name
  const shortAuthor = transaction.authorName?.split(" ")[0];

  // Build secondary info: Category · Wallet
  const secondaryParts = [transaction.category];
  if (transaction.walletContext) {
    secondaryParts.push(transaction.walletContext);
  }

  return (
    <Item size="sm" asChild>
      <button
        onClick={onClick}
        className="w-full text-left transition-colors hover:bg-accent/50"
      >
        <ItemMedia
          variant="icon"
          className="rounded-[10px]"
          style={
            iconBgColor && iconColor
              ? { backgroundColor: iconBgColor, color: iconColor, borderColor: "transparent" }
              : undefined
          }
        >
          <Icon size={16} />
        </ItemMedia>
        <ItemContent className="gap-0.5">
          <ItemTitle className="truncate text-sm">{transaction.name}</ItemTitle>
          <ItemDescription className="line-clamp-1 text-xs">
            {secondaryParts.join(" · ")}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <div className="flex flex-col items-end gap-0.5">
            <AmountText
              amount={transaction.amount}
              type={transaction.type}
              size="sm"
            />
            {shortAuthor && (
              <span className="text-[10px] text-muted-foreground">
                {shortAuthor}
              </span>
            )}
          </div>
        </ItemActions>
      </button>
    </Item>
  );
}
