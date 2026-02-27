"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { BudgetCard } from "@/components/budget/BudgetCard";
import { Skeleton } from "@/components/ui/skeleton";
import { FAB } from "@/components/shared/FAB";
import { CreateBudgetDrawer } from "@/components/budget/CreateBudgetDrawer";
import { EditBudgetDrawer } from "@/components/budget/EditBudgetDrawer";

export default function BudgetPage() {
  const { workspaceId } = useActiveWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);

  const { data: budgets, isLoading } = api.budget.getBudgets.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const activeBudget = budgets?.find(b => b.id === selectedBudget) ?? null;

  return (
    <>
      <PageHeader title="Anggaran" />

      <div className="space-y-4 px-5 pt-2 pb-32">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-[20px]" />
        ))}

        {!isLoading && budgets?.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            <p className="font-medium text-foreground">Belum ada anggaran</p>
            <p className="mt-1 text-sm">Buat anggaran untuk membatasi pengeluaran Anda.</p>
          </div>
        )}

        {!isLoading && budgets?.map(budget => (
          <BudgetCard
            key={budget.id}
            budget={budget as React.ComponentProps<typeof BudgetCard>["budget"]}
            onClick={() => setSelectedBudget(budget.id)}
          />
        ))}
      </div>

      <FAB onClick={() => setShowCreate(true)} />

      {workspaceId && (
        <CreateBudgetDrawer
          open={showCreate}
          onOpenChange={setShowCreate}
          workspaceId={workspaceId}
          existingCategoryIds={budgets?.map(b => b.categoryId).filter((id): id is string => id !== null) ?? []}
        />
      )}

      {activeBudget && (
        <EditBudgetDrawer
          open={!!selectedBudget}
          onOpenChange={(open) => !open && setSelectedBudget(null)}
          budget={activeBudget as React.ComponentProps<typeof EditBudgetDrawer>["budget"]}
        />
      )}
    </>
  );
}
