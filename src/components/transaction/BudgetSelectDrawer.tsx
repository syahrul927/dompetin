"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { api } from "@/trpc/react";
import { getCategoryIcon } from "@/lib/category-icons";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BudgetSelectDrawerProps {
  value: string; // budgetId
  onChange: (id: string) => void;
  workspaceId: string;
  children: React.ReactNode; // Trigger element
}

export function BudgetSelectDrawer({
  value,
  onChange,
  workspaceId,
  children,
}: BudgetSelectDrawerProps) {
  const [open, setOpen] = useState(false);
  const { data: budgets, isLoading } = api.budget.getBudgets.useQuery(
    { workspaceId },
    { enabled: open && !!workspaceId }
  );

  const handleSelect = (id: string) => {
    // Toggle off if same id selected
    onChange(value === id ? "" : id);
    setOpen(false);
  };

  return (
    <Drawer nested open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="max-h-[85vh] px-0 pb-0">
        <div className="px-5 pb-6 pt-2">
          <div className="mb-4 text-center">
            <DrawerTitle className="text-lg font-bold text-foreground">
              Pilih Anggaran (Opsional)
            </DrawerTitle>
          </div>

          <div className="h-[50vh] overflow-y-auto space-y-1 pr-2">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              ))}

            {!isLoading && budgets?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada anggaran
              </p>
            )}

            {!isLoading &&
              budgets?.map((budget) => {
                const Icon = getCategoryIcon(budget.icon);
                const isSelected = value === budget.id;

                return (
                  <div
                    key={budget.id}
                    onClick={() => handleSelect(budget.id)}
                    className="flex cursor-pointer items-center justify-between py-3 transition-colors active:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: `${budget.color}20`,
                          color: budget.color,
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      <span className="text-base font-medium text-foreground">
                        {budget.name}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}