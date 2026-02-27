# Transaction Update and Delete Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement transaction hard-deletion with balance reversion, and adapt the `AddTransactionSheet` for editing. Enhance `TransactionRow` to show the transaction author's name.

**Architecture:** We will replace the soft-delete mutation with a robust `deleteTransaction` mutation that hard-deletes rows and correctly reverts wallet balances inside a DB transaction. The UI will introduce `TransactionActionSheet` for edit/delete actions, restricted to the transaction creator. `AddTransactionSheet` will be refactored to handle `initialData` and an `editMode` flag to update existing records.

**Tech Stack:** Next.js App Router, tRPC, Drizzle ORM, Vaul (Drawers), TailwindCSS, Shadcn UI.

---

### Task 1: Update tRPC Transaction Router

**Files:**
- Modify: `src/server/api/routers/transaction.ts`

**Step 1: Replace soft delete with hard delete mutation**
Replace `softDeleteTransaction` with `deleteTransaction`.

```typescript
  deleteTransaction: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch transaction
      const existingTx = await db.query.transaction.findFirst({
        where: eq(transaction.id, input.id),
      });

      if (!existingTx) {
        throw new Error("Transaction not found");
      }

      // 2. Verify creator ONLY authorization
      if (existingTx.createdBy !== ctx.session.user.id) {
        throw new Error("Only the creator can delete this transaction");
      }

      // 3. Database transaction to delete and revert balances
      await db.transaction(async (tx) => {
        // Delete the transaction
        await tx.delete(transaction).where(eq(transaction.id, input.id));

        // Delete the paired transfer transaction if it exists
        if (existingTx.type === "transfer" && existingTx.transferId) {
            await tx.delete(transaction).where(and(
                eq(transaction.transferId, existingTx.transferId),
                // Avoid deleting the same row twice just in case
                sql`${transaction.id} != ${existingTx.id}`
            ));
        }

        const amountDb = Math.abs(parseFloat(existingTx.amount as unknown as string)).toFixed(2);

        // Revert balance based on type
        if (existingTx.type === "income") {
          // Revert income = subtract from wallet
          await tx
            .update(walletSchema)
            .set({
              balance: sql`${walletSchema.balance}::numeric - ${amountDb}::numeric`,
              updatedAt: new Date(),
            })
            .where(eq(walletSchema.id, existingTx.walletId));
        } else if (existingTx.type === "expense") {
          // Revert expense = add back to wallet
          await tx
            .update(walletSchema)
            .set({
              balance: sql`${walletSchema.balance}::numeric + ${amountDb}::numeric`,
              updatedAt: new Date(),
            })
            .where(eq(walletSchema.id, existingTx.walletId));
        } else if (existingTx.type === "transfer" && existingTx.toWalletId) {
            // Revert transfer: Add back to fromWallet, subtract from toWallet
            // Note: The transaction might be the debit or the credit side.
            // We use the walletId and toWalletId directly.
            // When we created it, we created two rows.

            const isDebit = parseFloat(existingTx.amount as unknown as string) < 0;
            const sourceWalletId = isDebit ? existingTx.walletId : existingTx.toWalletId;
            const destWalletId = isDebit ? existingTx.toWalletId : existingTx.walletId;

            // Add back to source
            await tx
              .update(walletSchema)
              .set({
                balance: sql`${walletSchema.balance}::numeric + ${amountDb}::numeric`,
                updatedAt: new Date(),
              })
              .where(eq(walletSchema.id, sourceWalletId));

            // Subtract from destination
            await tx
              .update(walletSchema)
              .set({
                balance: sql`${walletSchema.balance}::numeric - ${amountDb}::numeric`,
                updatedAt: new Date(),
              })
              .where(eq(walletSchema.id, destWalletId));
        }
      });

      return { success: true };
    }),
```

**Step 2: Update `updateTransaction` and `updateTransfer` authorization**
Ensure `updateTransaction` checks that `ctx.session.user.id === existingTx.createdBy`.
Modify `updateTransaction` to return early if no fields were provided.

Also add an `updateTransfer` mutation, as editing a transfer's amount requires updating two rows and reverting/reapplying wallet balances (complex!).
*Wait, standardizing*: We decided in the design that `AddTransactionSheet` uses `updateTransaction`. For V1, to avoid massive complexity with transfer balance re-calculations, if the user edits a transfer, they can only edit the *Name* and *Notes*.

**Refined Step 2:**
Update `updateTransaction` in `transaction.ts`:
```typescript
      // Get existing transaction
      const existingTx = await db.query.transaction.findFirst({
        where: eq(transaction.id, input.id),
      });

      if (!existingTx) {
        throw new Error("Transaction not found");
      }

      // Verify creator ONLY authorization
      if (existingTx.createdBy !== ctx.session.user.id) {
        throw new Error("Only the creator can edit this transaction");
      }
```
*Note: Remove the workspace access check and replace it with creator check as per user request.*

If `existingTx.type === "transfer"`, prevent updating `amount`, `categoryId`, `walletId`. Only allow `name`, `notes`, `date`.

**Step 3: Commit**
```bash
git add src/server/api/routers/transaction.ts
git commit -m "feat(api): add hard delete and creator auth for transactions"
```

---

### Task 2: Create TransactionActionSheet

**Files:**
- Create: `src/components/transaction/TransactionActionSheet.tsx`

**Step 1: Create the Component**
```tsx
"use client";

import React, { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/trpc/react";

interface Transaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  createdBy?: { id: string; name: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onEdit: () => void;
  currentUserId?: string;
}

export function TransactionActionSheet({ open, onOpenChange, transaction, onEdit, currentUserId }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTx = api.transaction.deleteTransaction.useMutation();
  const utils = api.useUtils();

  if (!transaction) return null;

  const isCreator = currentUserId === transaction.createdBy?.id;

  const handleDelete = async () => {
    try {
      await deleteTx.mutateAsync({ id: transaction.id });
      await utils.transaction.getTransactions.invalidate();
      await utils.transaction.getDashboardSummary.invalidate();
      await utils.wallet.getWallets.invalidate();
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-0 pb-8 pt-0">
          <DrawerHeader className="border-b px-5 pb-3 pt-4 text-left">
            <DrawerTitle>{transaction.name}</DrawerTitle>
            <p className="text-sm text-muted-foreground">{transaction.category}</p>
          </DrawerHeader>
          <div className="flex flex-col p-4 space-y-2">
            {!isCreator ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Hanya pembuat yang dapat mengubah transaksi ini.
              </p>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-14 text-base rounded-xl"
                  onClick={() => {
                    onOpenChange(false);
                    // Add slight delay to allow drawer to close smoothly
                    setTimeout(onEdit, 150);
                  }}
                >
                  <Pencil className="mr-3 h-5 w-5" />
                  Edit Transaksi
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-14 text-base text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-3 h-5 w-5" />
                  Hapus Transaksi
                </Button>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="w-[calc(100%-40px)] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi ini akan dihapus permanen dan saldo dompet akan disesuaikan kembali. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleteTx.isPending}
              className="h-12 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTx.isPending ? <Loader2 className="animate-spin" /> : "Ya, Hapus"}
            </AlertDialogAction>
            <AlertDialogCancel className="h-12 rounded-full border-none bg-muted hover:bg-muted/80 sm:mt-0">
              Batal
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Step 2: Commit**
```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "feat(ui): add TransactionActionSheet for edit/delete actions"
```

---

### Task 3: Refactor AddTransactionSheet for Edit Mode

**Files:**
- Modify: `src/components/transaction/AddTransactionSheet.tsx`

**Step 1: Update Props and State Initialization**
Add `initialData` to `AddTransactionSheetProps`.

```tsx
interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any; // The full transaction object from DB
}
```

Use `useEffect` to populate state when `initialData` changes and `open` is true:
```tsx
  useEffect(() => {
    if (open) {
      if (initialData) {
        setStep("details");

        let txType = initialData.type;
        if (txType === "transfer_debit" || txType === "transfer_credit") txType = "transfer";

        setType(txType);
        setAmountStr(Math.abs(Number(initialData.amount)).toString());
        setName(initialData.name);
        setDate(new Date(initialData.date).toISOString().split("T")[0]!);
        setNote(initialData.notes || "");

        if (txType === "transfer") {
          // Complex parsing for transfers if needed, else disable
        } else {
          setWalletId(initialData.wallet?.id || "");
          setCategoryId(initialData.category?.id || "");
        }
      } else {
        resetForm();
      }
    }
  }, [open, initialData]);
```

**Step 2: Disable TypeToggle and Restricted Fields**
In the UI, disable `TypeToggle` if `initialData` exists.
```tsx
<TypeToggle
  value={type}
  onChange={handleTypeChange}
  disabled={!!initialData}
/>
```

**Step 3: Handle Update Mutation**
Add `updateTransaction` mutation. Modify `handleSubmit`:
```tsx
  const updateTransaction = api.transaction.updateTransaction.useMutation();
```
In `handleSubmit`:
```tsx
      if (initialData) {
        // Edit mode
        if (type !== "transfer") {
           await updateTransaction.mutateAsync({
             id: initialData.id,
             name: name.trim(),
             notes: note.trim() || undefined,
             date: dateISO,
             amount: amountInCents,
             categoryId: resolvedCategoryId,
           });
        } else {
           // For transfers, only allow updating name/notes/date to avoid complex balance logic
           await updateTransaction.mutateAsync({
             id: initialData.id,
             name: name.trim(),
             notes: note.trim() || undefined,
             date: dateISO,
           });
        }
      } else {
        // ... existing create logic ...
```

**Step 4: Commit**
```bash
git add src/components/transaction/AddTransactionSheet.tsx
git commit -m "feat(ui): refactor AddTransactionSheet to support editing"
```

---

### Task 4: Integrate into UI & Enhance TransactionRow

**Files:**
- Modify: `src/components/shared/TransactionRow.tsx`
- Modify: `src/app/transactions/page.tsx`
- Modify: `src/components/dashboard/RecentTransactions.tsx`
- Modify: `src/components/wallets/WalletTransactionList.tsx`

**Step 1: Update `TransactionRow` to show Author**
Add `authorName?: string;` to `TransactionRowProps['transaction']`.
Update rendering:
```tsx
        <p className="mt-0.5 text-xs text-muted-foreground">
          {transaction.authorName ? `${transaction.authorName} · ` : ""}
          {transaction.category} · {transaction.date}
        </p>
```

**Step 2: Connect `TransactionActionSheet` in Pages**
In `src/app/transactions/page.tsx`:
- Map `createdBy` to `authorName` and include full `tx` data for sheet.
```tsx
      authorName: tx.createdBy?.name,
      createdBy: tx.createdBy,
      raw: tx, // pass raw transaction for edit sheet
```
- Add state: `const [actionTx, setActionTx] = useState<any>(null);`
- Add state: `const [editTx, setEditTx] = useState<any>(null);`
- Add Session: `const { data: session } = authClient.useSession();`
- Render Sheets at bottom:
```tsx
      <TransactionActionSheet
        open={!!actionTx}
        onOpenChange={(o) => !o && setActionTx(null)}
        transaction={actionTx}
        currentUserId={session?.user?.id}
        onEdit={() => setEditTx(actionTx?.raw)}
      />

      <AddTransactionSheet
        open={!!editTx}
        onOpenChange={(o) => !o && setEditTx(null)}
        initialData={editTx}
      />
```
- Update `TransactionRow` `onClick={() => setActionTx(tx)}`.

**Step 3: Repeat UI Integration for Dashboard & Wallet List**
Update `RecentTransactions.tsx` and `WalletTransactionList.tsx` to handle `onClick` or simply pass the onClick up to their parent pages to handle the Action Sheet logic.
*Recommendation for speed:* It's easiest to add the Action Sheet state to `DashboardPage` and `WalletDetailPage`, and pass `onTransactionClick={(tx) => setActionTx(tx)}` down through `RecentTransactions` and `WalletTransactionList`.

**Step 4: Commit**
```bash
git add src/components/shared/TransactionRow.tsx src/app/transactions/page.tsx src/components/dashboard/RecentTransactions.tsx src/components/wallets/WalletTransactionList.tsx src/app/dashboard/page.tsx src/app/wallets/[id]/page.tsx
git commit -m "feat(ui): integrate edit/delete actions and author names into lists"
```

---

**Plan complete and saved to `docs/plans/2026-02-27-transaction-update-delete-plan.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**