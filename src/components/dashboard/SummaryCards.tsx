import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { formatIDR } from "@/lib/formatIDR";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardsProps {
  monthlyIncome: number;
  monthlyExpense: number;
  isLoading?: boolean;
}

/**
 * The 2-column income/expense summary grid below the balance hero.
 */
export function SummaryCards({
  monthlyIncome,
  monthlyExpense,
  isLoading,
}: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-[20px] p-3.5">
          <Skeleton className="h-8 w-8 rounded-[10px]" />
          <Skeleton className="mt-2.5 h-3 w-20" />
          <Skeleton className="mt-1 h-5 w-24" />
        </Card>
        <Card className="rounded-[20px] p-3.5">
          <Skeleton className="h-8 w-8 rounded-[10px]" />
          <Skeleton className="mt-2.5 h-3 w-20" />
          <Skeleton className="mt-1 h-5 w-24" />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Income Card */}
      <Card className="flex flex-col gap-2.5 rounded-[20px] p-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10">
          <ArrowUp size={15} className="stroke-[2.5] text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pemasukan Hari Ini</p>
          <p className="text-[15px] font-bold text-primary">
            {formatIDR(monthlyIncome)}
          </p>
        </div>
      </Card>

      {/* Expense Card */}
      <Card className="flex flex-col gap-2.5 rounded-[20px] p-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-muted">
          <ArrowDown size={15} className="stroke-[2.5] text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pengeluaran Hari Ini</p>
          <p className="text-[15px] font-bold text-foreground">
            {formatIDR(monthlyExpense)}
          </p>
        </div>
      </Card>
    </div>
  );
}
