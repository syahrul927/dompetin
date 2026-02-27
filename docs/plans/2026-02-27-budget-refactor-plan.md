# Budget Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple Budgets from Categories, add `budgetId` to transactions, and update the UI accordingly.

**Architecture:**
1. Database migration: Drop `categoryId` from `budget`, add `icon`, `color`. Add `budgetId` to `transaction`.
2. Backend: Update `budgetRouter` to use the new schema for creation, updates, and calculation. Update `transactionRouter` to accept `budgetId`.
3. Frontend UI: Replace `CategorySelectDrawer` with icon/color pickers in the budget creation flow. Add an optional `BudgetSelectDrawer` to `AddTransactionSheet`. Update `BudgetPage` layout.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, Postgres, TailwindCSS.

---

### Task 1: Database Schema Updates

**Files:**
- Modify: `src/server/db/dompetin-schema.ts`

**Step 1: Update Schema**
Modify `transaction` table:
```typescript
  budgetId: uuidColumn("budget_id").references(() => budget.id, {
    onDelete: "set null",
  }),
```

Modify `budget` table:
Remove `categoryId`.
Add `icon` and `color`:
```typescript
  icon: varchar("icon", { length: 50 }).notNull().default("💰"),
  color: varchar("color", { length: 7 }).notNull().default("#3b82f6"),
```

Update Relations:
In `transactionRelations`:
```typescript
  budget: one(budget, {
    fields: [transaction.budgetId],
    references: [budget.id],
  }),
```
In `budgetRelations`: Remove `category` relation. Keep `workspace` relation. Add `transactions: many(transaction)`.

**Step 2: Generate and Apply Migration**
Run: `pnpm db:generate`
Run: `pnpm db:migrate`

**Step 3: Commit**
```bash
git add src/server/db/dompetin-schema.ts drizzle/
git commit -m "chore(db): decouple budgets from categories and add budgetId to transaction"
```

---

### Task 2: Backend Router Updates

**Files:**
- Modify: `src/server/api/routers/budget.ts`
- Modify: `src/server/api/routers/transaction.ts`

**Step 1: Update `budget.ts`**
In `getBudgets`:
Change `spentSubquery` to group and filter by `transaction.budgetId`:
```typescript
      const spentSubquery = db
        .select({
          budgetId: transaction.budgetId,
          totalSpent: sql<number>`COALESCE(SUM(ABS(${transaction.amount}::numeric)), 0)`.as('total_spent'),
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            eq(transaction.type, "expense"),
            isNull(transaction.deletedAt),
            sql`EXTRACT(YEAR FROM ${transaction.date}::timestamp) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${transaction.date}::timestamp) = ${currentMonth}`
          )
        )
        .groupBy(transaction.budgetId)
        .as('spent_subquery');
```

Update `getBudgets` main query selection to remove category joins and use `budgetSchema.icon` and `budgetSchema.color`:
```typescript
        .select({
          id: budgetSchema.id,
          name: budgetSchema.name,
          amount: budgetSchema.amount,
          icon: budgetSchema.icon,
          color: budgetSchema.color,
          spent: sql<number>`COALESCE(${spentSubquery.totalSpent}, 0)`,
        })
        .from(budgetSchema)
        .leftJoin(spentSubquery, eq(budgetSchema.id, spentSubquery.budgetId))
```

Update `getBudget`: Remove `with: { category: ... }`. Update `spentResult` to filter by `eq(transaction.budgetId, budgetData.id)`.

Update `createBudget`:
- Input schema: remove `categoryId`, add `icon`, `color`.
- Remove category validation.
- Remove `existingBudget` check (multiple budgets allowed, no category constraint).
- Insert with `icon` and `color`.

Update `updateBudget`: Remove `categoryId`, add `icon`, `color`.

**Step 2: Update `transaction.ts`**
In `createTransaction` and `updateTransaction`:
- Add `budgetId: z.string().uuid().optional()` to input schema.
- Insert/Update with `budgetId`.

**Step 3: Commit**
```bash
git add src/server/api/routers/budget.ts src/server/api/routers/transaction.ts
git commit -m "feat(api): update budget logic and support transaction budgetId"
```

---

### Task 3: Budget UI Refactor

**Files:**
- Modify: `src/components/budget/BudgetCard.tsx`
- Modify: `src/components/budget/CreateBudgetDrawer.tsx`
- Modify: `src/components/budget/EditBudgetDrawer.tsx`
- Modify: `src/app/budget/page.tsx`

**Step 1: Fix `BudgetPage` UI**
Remove `<FAB />`.
Add a standard outline button at the bottom of the list:
```tsx
      <div className="mt-6 flex justify-center pb-20">
        <Button
          variant="outline"
          className="h-12 rounded-full border-primary/20 text-primary hover:bg-primary/5 px-6"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Tambah Anggaran Baru
        </Button>
      </div>
```
(Import `Plus` from `lucide-react`, `Button` from ui/button). Remove `existingCategoryIds` from `CreateBudgetDrawer` props.

**Step 2: Fix `BudgetCard`**
Remove `categoryName`, `categoryIcon`, `categoryColor`. Use `icon` and `color` from budget directly. Fallback to default styling if undefined. (Remove the `categoryName` text render).

**Step 3: Fix `CreateBudgetDrawer` & `EditBudgetDrawer`**
Remove `CategorySelectDrawer`.
For V1 speed, we will hardcode a default icon and color when creating:
```typescript
      await createBudget.mutateAsync({
        workspaceId,
        amount,
        name: name.trim(),
        icon: "💰",
        color: "#3b82f6"
      });
```
(Full icon picker can be added later if needed, or simply render without the category picker for now).

**Step 4: Commit**
```bash
git add src/app/budget/page.tsx src/components/budget/
git commit -m "refactor(ui): update budget UI to remove category dependencies"
```

---

### Task 4: AddTransactionSheet Budget Integration & Double-Click Fix

**Files:**
- Create: `src/components/transaction/BudgetSelectDrawer.tsx`
- Modify: `src/components/transaction/AddTransactionSheet.tsx`

**Step 1: Create `BudgetSelectDrawer`**
Create a Vaul drawer component identical to `WalletSelectDrawer` but fetching `api.budget.getBudgets`. It allows selecting an active budget.

**Step 2: Add to `AddTransactionSheet`**
Add state: `const [budgetId, setBudgetId] = useState("")`.
Render conditionally if `type === "expense"`:
```tsx
                {type === "expense" && (
                  <BudgetSelectDrawer
                    value={budgetId}
                    onChange={setBudgetId}
                    workspaceId={workspaceId}
                  >
                    <FormRow
                      label="Anggaran"
                      value={selectedBudgetName}
                      placeholder="Pilih anggaran (Opsional)"
                    />
                  </BudgetSelectDrawer>
                )}
```
Add `budgetId: budgetId || undefined` to `createTransaction` and `updateTransaction` mutations.

**Step 3: Double-Click Fix**
The `isSubmitting` boolean is already applied to the Button's `disabled` prop in `AddTransactionSheet`. To make it bulletproof, add a local fast-state lock inside `handleSubmit`:
```typescript
  const [isLocked, setIsLocked] = useState(false);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || isLocked) return;
    setIsLocked(true);
    try {
       // ... existing logic ...
    } finally {
       setIsLocked(false);
    }
  };
```
And add `resetForm` to set `setIsLocked(false)`.

**Step 4: Commit**
```bash
git add src/components/transaction/
git commit -m "feat(ui): add optional budget selection to expense transactions and fix double submission"
```

---
**Execution Handoff:**
Plan complete. Execution will be subagent-driven in this session with auto-approval as requested.