import React from "react";
import { Card } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatIDR } from "@/lib/formatIDR";

interface BudgetCardProps {
  budget: {
    id: string;
    name: string;
    amount: number;
    spent: number;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
  };
  onClick: () => void;
}

export function BudgetCard({ budget, onClick }: BudgetCardProps) {
  const Icon = getCategoryIcon(budget.categoryIcon);
  const percentage = Math.min((budget.spent / budget.amount) * 100, 100);
  const isOverBudget = budget.spent > budget.amount;

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer rounded-[20px] p-5 transition-transform active:scale-[0.98] border border-border"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-opacity-20"
            style={{ backgroundColor: `${budget.categoryColor}20`, color: budget.categoryColor }}
          >
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{budget.name}</h3>
            <p className="text-xs text-muted-foreground">{budget.categoryName}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Terpakai {formatIDR(budget.spent)}</span>
          <span className="font-medium text-foreground">{formatIDR(budget.amount)}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isOverBudget && (
          <p className="text-xs font-medium text-destructive">
            Melebihi anggaran sebesar {formatIDR(budget.spent - budget.amount)}
          </p>
        )}
      </div>
    </Card>
  );
}