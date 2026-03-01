# Transfer Fee Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement an optional administrative fee toggle for transfers that automatically records an associated expense and bundles the display in the UI.

**Architecture:** We will add `isTransferFee: boolean` to the transaction schema to identify system-generated transfer fees. We'll update the tRPC `createTransfer`, `getTransactions`, `updateTransaction`, and `deleteTransaction` procedures to handle these grouped 3-record transfers. Finally, we'll update the Next.js/React frontend to display the fee toggle during creation and show a unified single row for transfers in the transaction list.

**Tech Stack:** Drizzle ORM, PostgreSQL, tRPC (v11), Zod, React, Tailwind CSS, shadcn/ui.

---

### Task 1: Update Database Schema

**Files:**
- Modify: `src/server/db/dompetin-schema.ts`

**Step 1: Add isTransferFee column**

Modify the transaction table schema to add the new boolean column.

```typescript
// src/server/db/dompetin-schema.ts
// Add to export const transaction = pgTable(...)
  isTransferFee: boolean("is_transfer_fee")
    .$defaultFn(() => false)
    .notNull(),
```

**Step 2: Generate and apply database migrations**

Run: `pnpm db:generate`
Expected: Success generating migration file.

Run: `pnpm db:migrate`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add src/server/db/dompetin-schema.ts supabase/migrations/
git commit -m "feat(db): add isTransferFee column to transaction schema"
```

---

### Task 2: Implement Transfer Fee Backend Creation

**Files:**
- Modify: `src/server/api/routers/transaction.ts`

**Step 1: Update createTransfer Input Schema**

Update the Zod schema in `createTransfer` to accept the optional fee amount.

```typescript
        amount: z.number().positive(), // Amount in cents
        feeAmount: z.number().nonnegative().optional(), // Transfer fee amount in cents
        name: z.string().min(1).max(255),
```

**Step 2: Update createTransfer Logic**

Inside the transaction block, if `feeAmount` > 0, find/create the "Biaya Transfer" category, deduct the fee from `fromWallet`, and insert the fee transaction.

```typescript
// In src/server/api/routers/transaction.ts `createTransfer` mutation:
        const feeAmountNum = input.feeAmount ? input.feeAmount / 100 : 0;
        const feeAmountDb = feeAmountNum.toFixed(2);

        // Deduct both transfer amount and fee from the source wallet
        await tx
          .update(walletSchema)
          .set({
            balance: (Number(currentFromWallet.balance) - amountNum - feeAmountNum).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(walletSchema.id, input.fromWalletId));

        // ... update toWallet ...

        // If fee exists, find/create category and insert fee transaction
        if (feeAmountNum > 0) {
           let feeCategory = await tx.query.category.findFirst({
              where: and(
                 eq(category.workspaceId, workspaceId),
                 eq(category.name, "Biaya Transfer"),
                 eq(category.type, "expense")
              )
           });

           if (!feeCategory) {
              const [newCat] = await tx.insert(category).values({
                 id: crypto.randomUUID(),
                 workspaceId,
                 name: "Biaya Transfer",
                 type: "expense",
                 icon: "receipt",
                 color: "#f43f5e", // rose-500
                 createdBy: ctx.session.user.id
              }).returning();
              feeCategory = newCat;
           }

           await tx.insert(transaction).values({
              id: crypto.randomUUID(),
              type: "expense",
              amount: feeAmountDb,
              name: "Biaya Admin Transfer",
              date: dateDb,
              walletId: input.fromWalletId,
              transferId, // Link to the transfer
              categoryId: feeCategory!.id,
              isTransferFee: true,
              workspaceId,
              createdBy: ctx.session.user.id,
           });
        }
```

**Step 3: Run Typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/api/routers/transaction.ts
git commit -m "feat(api): implement transfer fee creation logic in createTransfer"
```

---

### Task 3: Update Transaction Aggregation in getTransactions

**Files:**
- Modify: `src/server/api/routers/transaction.ts`

**Step 1: Group transfers in the query output**

Modify the `getTransactions` resolver to post-process the DB results, grouping legs by `transferId`. Note: we only want to return ONE item per `transferId` so the UI lists it as a single row. The standard representation should be the "Sender Debit" leg, enriched with the `feeAmount`.

```typescript
// After fetching items from the DB in getTransactions:
      // Group transfers
      const groupedItems: typeof items = [];
      const processedTransfers = new Set<string>();

      for (const item of items) {
        if (item.type === "transfer" && item.transferId) {
          if (processedTransfers.has(item.transferId)) continue;

          processedTransfers.add(item.transferId);

          // Find all pieces of this transfer from the DB (since pagination might cut them off)
          const allPieces = await db.query.transaction.findMany({
            where: and(
              eq(transaction.transferId, item.transferId),
              isNull(transaction.deletedAt)
            ),
            with: {
               wallet: true,
               toWallet: true,
            }
          });

          const debitLeg = allPieces.find(p => p.type === "transfer" && p.amount.startsWith('-'));
          const feeLeg = allPieces.find(p => p.isTransferFee);

          if (debitLeg) {
             // Use debit leg as the primary record to return
             groupedItems.push({
                ...debitLeg,
                // Attach custom data so the UI knows there is a fee
                feeAmount: feeLeg ? parseFloat(feeLeg.amount) : 0
             } as any);
          }
        } else if (!item.isTransferFee) { // Don't show independent transfer fees directly
          groupedItems.push(item);
        }
      }

      // return { items: groupedItems, nextCursor };
```

*Note: You may need to update the returned tRPC schema types if necessary, but returning the raw `any` cast is an acceptable temporary measure if type constraints are rigid. The front-end expects `Transaction` + relations.*

**Step 2: Run Typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/api/routers/transaction.ts
git commit -m "feat(api): group transfer transactions and fees into a single item in getTransactions"
```

---

### Task 4: Fix Update/Delete Procedures for Transfer Groups

**Files:**
- Modify: `src/server/api/routers/transaction.ts`

**Step 1: Update deleteTransaction**

When `deleteTransaction` targets a transfer (or a fee), it should soft-delete all linked records by `transferId` and refund the appropriate amounts to both wallets.

```typescript
// Inside deleteTransaction logic:
        if (existingTx.transferId) {
           const linkedTxs = await db.query.transaction.findMany({
              where: eq(transaction.transferId, existingTx.transferId)
           });

           await db.transaction(async (tx) => {
              for (const linked of linkedTxs) {
                 // Soft delete
                 await tx.update(transaction)
                    .set({ deletedAt: new Date(), deletedBy: ctx.session.user.id })
                    .where(eq(transaction.id, linked.id));

                 // Refund wallet balances
                 const wallet = await tx.query.wallet.findFirst({ where: eq(walletSchema.id, linked.walletId) });
                 if (wallet) {
                    const refundAmount = linked.type === 'transfer' && !linked.amount.startsWith('-')
                       ? -Number(linked.amount) // Undo credit
                       : Math.abs(Number(linked.amount)); // Undo debit or expense fee

                    await tx.update(walletSchema)
                       .set({ balance: (Number(wallet.balance) + refundAmount).toFixed(2) })
                       .where(eq(walletSchema.id, wallet.id));
                 }
              }
           });
        }
```

**Step 2: Commit**

```bash
git add src/server/api/routers/transaction.ts
git commit -m "fix(api): ensure deleteTransaction rolls back complete transfer groups"
```

---

### Task 5: Frontend UI - Add Transfer Fee Toggle to Form

**Files:**
- Modify: `src/components/transaction/InsertTransactionForm.tsx` (or whatever the path is to the transaction input form)

**Step 1: Add Switch and Input UI**

Add a boolean state for the switch, and a number state for the fee amount. Render it inside the "Transfer" tab of the transaction form.

```tsx
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Inside component state:
const [hasFee, setHasFee] = useState(false);
const [feeAmount, setFeeAmount] = useState<number | undefined>();

// Inside Transfer render block:
<div className="flex items-center space-x-2 my-4">
  <Switch id="has-fee" checked={hasFee} onCheckedChange={setHasFee} />
  <Label htmlFor="has-fee">Ada Biaya Transfer?</Label>
</div>

{hasFee && (
  <div className="space-y-2 mb-4">
     <Label htmlFor="fee-amount">Nominal Biaya Transfer</Label>
     <Input
        id="fee-amount"
        type="number"
        value={feeAmount || ''}
        onChange={(e) => setFeeAmount(e.target.value ? Number(e.target.value) : undefined)}
        placeholder="Rp 0"
     />
  </div>
)}

// Inside submission handler:
createTransfer.mutate({
  ...data,
  feeAmount: hasFee && feeAmount ? feeAmount * 100 : undefined
});
```

**Step 2: Run Linters/Typecheck**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/transaction/InsertTransactionForm.tsx
git commit -m "feat(ui): add transfer fee toggle and input to transaction form"
```

---

### Task 6: Frontend UI - Unified Transfer Display in List

**Files:**
- Modify: `src/components/transaction/TransactionList.tsx` (or equivalent file)

**Step 1: Update the row display**

Check if the transaction type is a transfer. Use a unique icon. Show the "From → To" wallets. If `feeAmount` is present, display it below the main transfer amount.

```tsx
// Inside TransactionItem component:
const isTransfer = transaction.type === 'transfer';
// (Ensure backend passes feeAmount on the transaction object via extending the type)
const feeAmount = (transaction as any).feeAmount as number | undefined;

// Render logic:
{isTransfer && (
  <div className="flex justify-between items-center w-full">
     <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
           <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex flex-col">
           <span className="font-medium text-sm">Transfer</span>
           <span className="text-xs text-muted-foreground">
              {transaction.wallet?.name} → {transaction.toWallet?.name}
           </span>
        </div>
     </div>
     <div className="flex flex-col items-end">
        <span className="font-semibold text-sm">
           {formatIDR(Math.abs(Number(transaction.amount)))}
        </span>
        {feeAmount && feeAmount > 0 && (
           <span className="text-[10px] text-muted-foreground mt-0.5">
              (+ Biaya {formatIDR(feeAmount)})
           </span>
        )}
     </div>
  </div>
)}
```

**Step 2: Run Linters/Typecheck**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/transaction/TransactionList.tsx
git commit -m "feat(ui): display unified transfer rows with optional fee amount"
```