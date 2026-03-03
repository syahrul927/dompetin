import React from "react";
import { Card } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatIDR } from "@/lib/formatIDR";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface BudgetCardProps {
  budget: {
    id: string;
    name: string;
    amount: number;
    spent: number;
    icon: string;
    color: string;
    startDate: string | Date;
    endDate: string | Date | null;
    isActive?: boolean;
  };
  onClick: () => void;
}

export function BudgetCard({ budget, onClick }: BudgetCardProps) {
  const Icon = getCategoryIcon(budget.icon);
  const percentage = Math.min((budget.spent / budget.amount) * 100, 100);
  const isOverBudget = budget.spent > budget.amount;
  const isArchived = budget.isActive === false;

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer rounded-[20px] p-5 transition-transform active:scale-[0.98] border border-border ${
        isArchived ? "opacity-75 grayscale-[0.2]" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-opacity-20"
            style={{ backgroundColor: `${budget.color}20`, color: budget.color }}
          >
            <Icon size={20} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{budget.name}</h3>
              {isArchived && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Arsip
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(budget.startDate), "d MMM yyyy", { locale: localeId })}
              {budget.endDate ? ` - ${format(new Date(budget.endDate), "d MMM yyyy", { locale: localeId })}` : ""}
            </span>
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