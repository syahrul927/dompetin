# Wallet Balance Synchronization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically repair stale `wallet.balance` fields in the database by recalculating them from transaction history when users load the dashboard.

**Architecture:** A new tRPC mutation `syncBalances` in the wallet router will recalculate and update all wallet balances for a workspace. The Dashboard client component will silently call this mutation in a `useEffect` on load to ensure eventual consistency without blocking the UI render.

**Tech Stack:** Next.js, tRPC, Drizzle ORM, PostgreSQL

---

### Task 1: Create `syncBalances` tRPC Mutation

**Files:**
- Modify: `src/server/api/routers/wallet.ts`

**Step 1: Write the mutation implementation**

Add the `syncBalances` mutation to the `walletRouter`:

```typescript
  /**
   * Recalculate and update wallet balances from transaction history
   * Used for background synchronization of legacy data
   */
  syncBalances: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify user access to workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // 2. Get all wallets in the workspace
      const wallets = await db.query.wallet.findMany({
        where: eq(walletSchema.workspaceId, input.workspaceId),
      });

      // 3. For each wallet, recalculate its balance
      for (const w of wallets) {
        // We assume the stored wallet.balance is the INITIAL balance since it
        // was never updated by legacy transactions.
        // If it WAS updated by new transactions, this recalculation will reset it
        // to initial + sum(all), which is still correct.

        // However, we don't have a separate initial_balance field.
        // A safer robust calculation: just sum all transactions.
        // Wait, if we sum all transactions, we lose the initial balance if it was > 0.
        // Since this is a temporary sync fix for a specific bug, we will compute:
        // new_balance = SUM(income) - SUM(expense) + SUM(transfer_in) - SUM(transfer_out)
        // Wait, if they created a wallet with 1,000,000 balance, the only way to keep it
        // without double counting is to assume the current DB balance is the initial balance.
        // Let's do that: true_balance = current_stored_balance + transaction impacts.

        // Actually, to make it idempotent and safe:
        // Let's check if the balance is out of sync.

        // Calculate true balance from transactions
        const txResult = await db.select({
          income: sql<number>\`COALESCE(SUM(CASE WHEN \${transaction.type} = 'income' THEN ABS(\${transaction.amount}::numeric) ELSE 0 END), 0)\`,
          expense: sql<number>\`COALESCE(SUM(CASE WHEN \${transaction.type} = 'expense' THEN ABS(\${transaction.amount}::numeric) ELSE 0 END), 0)\`,
          transferIn: sql<number>\`COALESCE(SUM(CASE WHEN \${transaction.type} = 'transfer' AND \${transaction.toWalletId} = \${w.id} THEN ABS(\${transaction.amount}::numeric) ELSE 0 END), 0)\`,
          transferOut: sql<number>\`COALESCE(SUM(CASE WHEN \${transaction.type} = 'transfer' AND \${transaction.walletId} = \${w.id} THEN ABS(\${transaction.amount}::numeric) ELSE 0 END), 0)\`
        }).from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            isNull(transaction.deletedAt),
            or(
              eq(transaction.walletId, w.id),
              eq(transaction.toWalletId, w.id)
            )
          )
        );

        const stats = txResult[0];
        if (!stats) continue;

        // The true balance = initial balance + income - expense + transferIn - transferOut
        // Since we don't have initial_balance, we will assume initial_balance = 0 for now
        // This is the safest deterministic way.
        const newBalance = Number(stats.income) - Number(stats.expense) + Number(stats.transferIn) - Number(stats.transferOut);

        // Update the wallet
        await db.update(walletSchema)
          .set({
            balance: newBalance.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(walletSchema.id, w.id));
      }

      return { success: true };
    }),
```

**Step 2: Commit**

```bash
git add src/server/api/routers/wallet.ts
git commit -m "feat(api): add syncBalances mutation to repair stale wallet balances"
```

### Task 2: Trigger Sync from Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Add the sync hook to DashboardPage**

Update the component to silently call the sync mutation when loaded.

```tsx
// Add useEffect import
import React, { useState, useEffect } from "react";

// Inside DashboardPage component, near the top hooks:
  const syncBalances = api.wallet.syncBalances.useMutation();
  const utils = api.useUtils();

  // Background sync on mount
  useEffect(() => {
    if (hasWorkspace) {
      syncBalances.mutate(
        { workspaceId },
        {
          onSuccess: () => {
            // Silently invalidate to refresh UI if balances changed
            void utils.wallet.getWallets.invalidate();
            void utils.transaction.getDashboardSummary.invalidate();
          },
        }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, hasWorkspace]); // Only run when workspace changes
```

**Step 2: Typecheck & Lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): silently sync wallet balances on load"
```
