"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { BudgetCard } from "@/components/budget/BudgetCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

        {!isLoading && (
          <div className="mt-6 flex justify-center pb-10 pt-4">
            <Button
              variant="outline"
              className="h-12 rounded-full border-primary/20 text-primary hover:bg-primary/5 px-6"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Anggaran Baru
            </Button>
          </div>
        )}
      </div>

      {workspaceId && (
        <CreateBudgetDrawer
          open={showCreate}
          onOpenChange={setShowCreate}
          workspaceId={workspaceId}
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
