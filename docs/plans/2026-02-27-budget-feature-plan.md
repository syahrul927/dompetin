# Budget Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Anggaran (Budget) feature where users can create monthly spending limits for specific categories and track their exact spending dynamically.

**Architecture:** Update `budget.ts` tRPC router to compute current month spending dynamically per category. Build the UI in `src/app/budget/page.tsx` with list view and creation/edit drawers.

**Tech Stack:** Next.js 15, React, tRPC, Drizzle ORM, Tailwind CSS v4, shadcn/ui

---

### Task 1: Add Budget Backend Router

**Files:**
- Modify: `src/server/api/routers/budget.ts`

**Step 1: Rewrite getBudgets query to compute spending**

Update the `getBudgets` query to fetch active budgets, join with categories, and dynamically calculate the `spent` amount from transactions in the current month for each category.

```typescript
  getBudgets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        isActive: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Use a subquery to get total spent per category in the current month
      const spentSubquery = db
        .select({
          categoryId: transaction.categoryId,
          totalSpent: sql<number>\`COALESCE(SUM(ABS(\${transaction.amount}::numeric)), 0)\`.as('total_spent'),
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            eq(transaction.type, "expense"),
            isNull(transaction.deletedAt),
            sql\`EXTRACT(YEAR FROM \${transaction.date}::timestamp) = \${currentYear}\`,
            sql\`EXTRACT(MONTH FROM \${transaction.date}::timestamp) = \${currentMonth}\`
          )
        )
        .groupBy(transaction.categoryId)
        .as('spent_subquery');

      const budgets = await db
        .select({
          id: budgetSchema.id,
          name: budgetSchema.name,
          amount: budgetSchema.amount,
          categoryId: budgetSchema.categoryId,
          categoryName: categorySchema.name,
          categoryIcon: categorySchema.icon,
          categoryColor: categorySchema.color,
          spent: sql<number>\`COALESCE(\${spentSubquery.totalSpent}, 0)\`,
        })
        .from(budgetSchema)
        .innerJoin(categorySchema, eq(budgetSchema.categoryId, categorySchema.id))
        .leftJoin(spentSubquery, eq(budgetSchema.categoryId, spentSubquery.categoryId))
        .where(
          and(
            eq(budgetSchema.workspaceId, input.workspaceId),
            eq(budgetSchema.isActive, input.isActive)
          )
        )
        .orderBy(desc(budgetSchema.createdAt));

      // Convert string amounts to numbers
      return budgets.map((b) => ({
        ...b,
        amount: parseFloat(b.amount as unknown as string),
        spent: Number(b.spent),
      }));
    }),
```

**Step 2: Rewrite createBudget to enforce 1:1 mapping**

Update `createBudget`:
```typescript
  createBudget: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        amount: z.number().positive(),
        categoryId: z.string().uuid(),
        workspaceId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify workspace access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Ensure no budget exists for this category
      const existingBudget = await db.query.budget.findFirst({
        where: and(
          eq(budgetSchema.workspaceId, input.workspaceId),
          eq(budgetSchema.categoryId, input.categoryId),
          eq(budgetSchema.isActive, true)
        ),
      });

      if (existingBudget) {
        throw new Error("Kategori ini sudah memiliki anggaran aktif");
      }

      // Create budget
      const [newBudget] = await db
        .insert(budgetSchema)
        .values({
          name: input.name,
          amount: input.amount.toFixed(2),
          categoryId: input.categoryId,
          workspaceId: input.workspaceId,
          period: "monthly",
          spent: "0", // Default unused column
        })
        .returning();

      return newBudget!;
    }),
```

**Step 3: Update `updateBudget`**
```typescript
  updateBudget: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        amount: z.number().positive().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // (Keep existing fetch and auth validation)

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.amount !== undefined) updateData.amount = input.amount.toFixed(2);
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const [updated] = await db
        .update(budgetSchema)
        .set(updateData)
        .where(eq(budgetSchema.id, input.id))
        .returning();

      return updated!;
    }),
```

**Step 4: Typecheck & Commit**
```bash
git add src/server/api/routers/budget.ts
git commit -m "feat(api): implement dynamic budget spending calculation"
```

### Task 2: Create Budget List UI

**Files:**
- Modify: `src/app/budget/page.tsx`
- Create: `src/components/budget/BudgetCard.tsx`

**Step 1: Create `BudgetCard` component**

```tsx
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
```

**Step 2: Update Budget Page**

```tsx
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
            budget={budget as any}
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
          existingCategoryIds={budgets?.map(b => b.categoryId) ?? []}
        />
      )}

      {activeBudget && (
        <EditBudgetDrawer
          open={!!selectedBudget}
          onOpenChange={(open) => !open && setSelectedBudget(null)}
          budget={activeBudget as any}
        />
      )}
    </>
  );
}
```

**Step 3: Commit**
```bash
git add src/app/budget/page.tsx src/components/budget/BudgetCard.tsx
git commit -m "feat(budget): add budget list view with dynamic progress cards"
```

### Task 3: Create Budget Drawers

**Files:**
- Create: `src/components/budget/CreateBudgetDrawer.tsx`
- Create: `src/components/budget/EditBudgetDrawer.tsx`

**Step 1: Implement CreateBudgetDrawer**

```tsx
"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormRow } from "@/components/shared/FormRow";
import { CategorySelectDrawer } from "@/components/transaction/CategorySelectDrawer";
import { AmountInput } from "@/components/transaction/AmountInput";
import { Numpad } from "@/components/shared/Numpad";
import { api } from "@/trpc/react";
import { Loader2 } from "lucide-react";
import { isDefaultCategoryId } from "@/lib/default-categories";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  existingCategoryIds: string[];
}

export function CreateBudgetDrawer({ open, onOpenChange, workspaceId, existingCategoryIds }: Props) {
  const [step, setStep] = useState<"amount" | "details">("amount");
  const [amountStr, setAmountStr] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");

  const utils = api.useUtils();
  const createBudget = api.budget.createBudget.useMutation();
  const resolveCategory = api.category.resolveCategory.useMutation();

  const { data: categories } = api.category.getCategories.useQuery(
    { workspaceId, type: "expense" },
    { enabled: open }
  );

  const amount = parseInt(amountStr, 10) || 0;
  const selectedCategoryName = categories?.find(c => c.id === categoryId)?.name;

  // Custom validation check
  const isCategoryTaken = existingCategoryIds.includes(categoryId);
  const canSubmit = amount > 0 && categoryId && name.trim().length > 0 && !isCategoryTaken;

  const resetForm = () => {
    setStep("amount");
    setAmountStr("0");
    setCategoryId("");
    setName("");
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      let resolvedCategoryId = categoryId;
      if (isDefaultCategoryId(categoryId)) {
        const result = await resolveCategory.mutateAsync({ categoryId, workspaceId });
        resolvedCategoryId = result.id;
      }

      await createBudget.mutateAsync({
        workspaceId,
        categoryId: resolvedCategoryId,
        amount,
        name: name.trim(),
      });

      await utils.budget.getBudgets.invalidate();
      resetForm();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DrawerContent className="max-h-[95dvh] px-0 pb-0 pt-0">
        <DrawerHeader className="border-b px-5 pb-3 pt-4">
          <DrawerTitle>{step === "amount" ? "Buat Anggaran" : "Detail Anggaran"}</DrawerTitle>
        </DrawerHeader>

        {step === "amount" ? (
          <div className="flex flex-1 flex-col">
            <div className="py-6">
              <AmountInput value={amount} />
            </div>
            <div className="px-5 pb-2 pt-1">
              <Numpad value={amountStr} onChange={setAmountStr} />
            </div>
            <div className="px-5 pb-8 pt-2">
              <Button
                onClick={() => setStep("details")}
                className="h-12 w-full rounded-full bg-primary font-semibold text-white"
                disabled={amount === 0}
              >
                Lanjut
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <span className="text-sm text-muted-foreground">Batas Anggaran</span>
              <button type="button" onClick={() => setStep("amount")} className="text-lg font-bold">
                Rp {amount.toLocaleString("id-ID")}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
              <div className="space-y-2">
                <Label>Nama Anggaran</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Makan Siang"
                  className="h-12 rounded-2xl"
                />
              </div>

              <CategorySelectDrawer value={categoryId} type="expense" onChange={setCategoryId} workspaceId={workspaceId}>
                <FormRow label="Kategori" value={selectedCategoryName} placeholder="Pilih Kategori" />
              </CategorySelectDrawer>
              {isCategoryTaken && <p className="text-xs text-destructive">Kategori ini sudah memiliki anggaran.</p>}
            </div>

            <div className="border-t px-5 pb-8 pt-3">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createBudget.isPending || resolveCategory.isPending}
                className="h-12 w-full rounded-full bg-primary font-semibold text-white"
              >
                {(createBudget.isPending || resolveCategory.isPending) ? <Loader2 className="animate-spin" /> : "Simpan Anggaran"}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
```

**Step 2: Implement EditBudgetDrawer**
(Create basic Edit Drawer allowing name and amount changes, and delete function using existing AlertDialog pattern).

**Step 3: Typecheck & Commit**
Run: `pnpm typecheck`

```bash
git add src/components/budget/
git commit -m "feat(budget): add create and edit budget drawer flows"
```