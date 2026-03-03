# Budget Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the budget feature with auto-renewal logic, precise fixed-calendar boundaries (weekly, monthly, yearly), and visual separation between active and archived budgets.

**Architecture:** Use a "lazy" auto-renewal strategy in the `getBudgets` tRPC query. Whenever active budgets are fetched, the backend checks for expired ones based on calendar boundaries, marks them inactive (archived), and creates a new budget for the current period. The frontend will be updated to display start/end dates and provide an Active/Archived tab view.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, Tailwind CSS, shadcn/ui.

---

## Part 1: Backend Logistics

### Task 1: Utility for Date Boundaries
We need a robust way to calculate the start and end dates based on a given date and period.

**Files:**
- Create: `src/lib/date-utils.ts`

**Step 1: Write utility functions**

```typescript
// src/lib/date-utils.ts
export type BudgetPeriod = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Calculates the strict calendar start and end dates for a given period and reference date.
 * Returns dates in UTC midnight to avoid local timezone shifts during DB insertion.
 */
export function getPeriodBoundaries(period: BudgetPeriod, referenceDate: Date = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const date = referenceDate.getDate();

  let start: Date;
  let end: Date;

  switch (period) {
    case "daily":
      start = new Date(year, month, date, 0, 0, 0, 0);
      end = new Date(year, month, date, 23, 59, 59, 999);
      break;
    case "weekly":
      // Assuming Monday is the first day of the week
      const day = referenceDate.getDay();
      const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start = new Date(year, month, diff, 0, 0, 0, 0);
      end = new Date(year, month, diff + 6, 23, 59, 59, 999);
      break;
    case "monthly":
      start = new Date(year, month, 1, 0, 0, 0, 0);
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      break;
    case "yearly":
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
      break;
  }

  return { start, end };
}
```

**Step 2: Commit**

```bash
git add src/lib/date-utils.ts
git commit -m "feat(budget): add date utility for calculating fixed period boundaries"
```

### Task 2: Update Budget Creation Logic

**Files:**
- Modify: `src/server/api/routers/budget.ts`

**Step 1: Modify `createBudget`**
Update the `createBudget` mutation to automatically assign `startDate` and `endDate` based on the selected period using the new utility.

```typescript
// Inside src/server/api/routers/budget.ts
// Add import: import { getPeriodBoundaries } from "@/lib/date-utils";

// Update createBudget mutation:
  createBudget: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        amount: z.number().positive(), // Amount in cents
        period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"), // Add daily
        icon: z.string().min(1).max(50).default("💰"),
        color: z.string().min(1).max(7).default("#3b82f6"),
        workspaceId: z.string().uuid(),
        // remove startDate and endDate from input, calculate them automatically
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ... authorization check ...

      const amountDb = (input.amount / 100).toFixed(2);

      // Calculate boundaries
      const { start, end } = getPeriodBoundaries(input.period);

      const [newBudget] = await db.insert(budgetSchema).values({
        name: input.name,
        amount: amountDb,
        spent: "0",
        period: input.period,
        icon: input.icon,
        color: input.color,
        workspaceId: input.workspaceId,
        startDate: start,
        endDate: end,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return newBudget;
    }),
```

**Step 2: Commit**

```bash
git add src/server/api/routers/budget.ts
git commit -m "feat(budget): automatically calculate start and end dates on creation"
```

### Task 3: Implement Lazy Auto-Renewal

**Files:**
- Modify: `src/server/api/routers/budget.ts`

**Step 1: Modify `getBudgets` to handle auto-renewal and accurate spent calculations**

```typescript
// Inside src/server/api/routers/budget.ts
  getBudgets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      // ... authorization check ...

      // 1. Fetch requested budgets
      const budgets = await db.query.budget.findMany({
        where: and(
          eq(budgetSchema.workspaceId, input.workspaceId),
          eq(budgetSchema.isActive, input.isActive)
        ),
        orderBy: [desc(budgetSchema.createdAt)],
      });

      const now = new Date();
      const updatedBudgets = [];

      // 2. Process Auto-Renewal for active budgets
      if (input.isActive) {
        for (const b of budgets) {
          // Check if budget has expired
          if (b.endDate && b.endDate < now) {
            // Archive old budget
            await db.update(budgetSchema)
              .set({ isActive: false, updatedAt: new Date() })
              .where(eq(budgetSchema.id, b.id));

            // Create new budget for current period
            const { start, end } = getPeriodBoundaries(b.period as BudgetPeriod);

            const [newBudget] = await db.insert(budgetSchema).values({
              name: b.name,
              amount: b.amount,
              spent: "0",
              period: b.period,
              icon: b.icon,
              color: b.color,
              workspaceId: b.workspaceId,
              startDate: start,
              endDate: end,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();

            updatedBudgets.push(newBudget);
          } else {
            updatedBudgets.push(b);
          }
        }
      } else {
        updatedBudgets.push(...budgets);
      }

      // 3. Calculate accurate spent amount for each budget based on its specific dates
      const results = await Promise.all(updatedBudgets.map(async (b) => {
        const spentResult = await db
          .select({
            totalSpent: sql<number>`COALESCE(SUM(ABS(${transaction.amount}::numeric)), 0)`,
          })
          .from(transaction)
          .where(
            and(
              eq(transaction.budgetId, b.id),
              eq(transaction.type, "expense"),
              isNull(transaction.deletedAt),
              gte(transaction.date, b.startDate),
              b.endDate ? lte(transaction.date, b.endDate) : undefined
            )
          );

        return {
          ...b,
          amount: parseFloat(b.amount as string),
          spent: Number(spentResult[0]?.totalSpent ?? 0),
        };
      }));

      return results;
    }),
```

**Step 2: Update `getBudget` spent calculation**
Ensure `getBudget` also uses the budget's specific `startDate` and `endDate` instead of generic current month.

**Step 3: Commit**

```bash
git add src/server/api/routers/budget.ts
git commit -m "feat(budget): implement lazy auto-renewal and accurate spent calculations"
```

---

## Part 2: Frontend Implementation

### Task 4: Update BudgetCard UI

**Files:**
- Modify: `src/components/budget/BudgetCard.tsx`

**Step 1: Add date display**
Show the start and end dates formatted nicely. Add an `isArchived` prop to maybe show a badge or gray it out slightly if needed.

```tsx
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Add to BudgetCardProps:
// startDate: Date;
// endDate: Date | null;
// isActive: boolean;

// Inside component:
<div className="flex flex-col">
  <h3 className="font-semibold text-foreground">{budget.name}</h3>
  <span className="text-xs text-muted-foreground">
    {format(new Date(budget.startDate), "d MMM yyyy", { locale: id })}
    {budget.endDate ? ` - ${format(new Date(budget.endDate), "d MMM yyyy", { locale: id })}` : ""}
  </span>
</div>
```

**Step 2: Commit**

```bash
git add src/components/budget/BudgetCard.tsx
git commit -m "feat(budget): display period dates on budget card"
```

### Task 5: Budget List Tabs (Active vs Archived)

**Files:**
- Modify: `src/app/budget/page.tsx` (or wherever the list is rendered)

**Step 1: Implement Tabs**
Use shadcn/ui Tabs to toggle between `isActive=true` and `isActive=false`.

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

// In component:
const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
const { data: budgets } = api.budget.getBudgets.useQuery({
  workspaceId,
  isActive: activeTab === "active"
});

return (
  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "archived")}>
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="active">Aktif</TabsTrigger>
      <TabsTrigger value="archived">Arsip</TabsTrigger>
    </TabsList>
    <TabsContent value="active">
       {/* Map budgets */}
    </TabsContent>
    <TabsContent value="archived">
       {/* Map budgets */}
    </TabsContent>
  </Tabs>
)
```

**Step 2: Commit**

```bash
git add src/app/budget/page.tsx
git commit -m "feat(budget): add active and archived tabs to budget view"
```

### Task 6: Disable Editing for Archived Budgets

**Files:**
- Modify: `src/app/budget/page.tsx` (or where the click handler is)
- Modify: `src/components/budget/EditBudgetDrawer.tsx`

**Step 1: Add check**
Only open the `EditBudgetDrawer` if the budget is active, or pass an `isReadOnly` flag to the drawer to hide the save/delete buttons.

```tsx
// In Budget List mapping:
<BudgetCard
  budget={b}
  onClick={() => {
    if (activeTab === "active") {
      setSelectedBudget(b.id);
      setEditDrawerOpen(true);
    }
  }}
/>
```

**Step 2: Commit**

```bash
git add src/app/budget/page.tsx
git commit -m "feat(budget): prevent editing of archived budgets"
```
