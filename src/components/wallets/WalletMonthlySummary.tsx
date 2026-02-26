import React from "react";
import { formatIDR } from "@/lib/formatIDR";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface WalletMonthlySummaryProps {
  income: number;
  expense: number;
}

/**
 * Side-by-side income vs expense summary within a card.
 * Progress bars indicate relative proportion.
 */
export function WalletMonthlySummary({
  income,
  expense,
}: WalletMonthlySummaryProps) {
  const maxAmount = Math.max(income, expense, 1);
  const incomePercent = Math.round((income / maxAmount) * 100);
  const expensePercent = Math.round((expense / maxAmount) * 100);

  return (
    <Card className="rounded-[20px] p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Ringkasan Bulan Ini
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {/* Income */}
        <div>
          <p className="text-xs text-muted-foreground">Pemasukan</p>
          <p className="mt-0.5 text-base font-bold text-foreground">
            {formatIDR(income)}
          </p>
          <Progress
            value={incomePercent}
            className="mt-2 h-1.5 rounded-full [&>div]:bg-primary"
          />
        </div>

        {/* Expense */}
        <div>
          <p className="text-xs text-muted-foreground">Pengeluaran</p>
          <p className="mt-0.5 text-base font-bold text-foreground">
            {formatIDR(expense)}
          </p>
          <Progress
            value={expensePercent}
            className="mt-2 h-1.5 rounded-full [&>div]:bg-muted-foreground"
          />
        </div>
      </div>
    </Card>
  );
}
