# Transaction Wallet Context UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the transaction lists (Dashboard, Transactions Page, Wallet detail) to display the name of the associated wallet(s).

**Architecture:** We will modify the tRPC routers to eagerly load wallet data where needed, map that data to a `walletContext` string in the parent React components, and pass it to the `TransactionRow` UI component to render seamlessly in the subtitle.

**Tech Stack:** Next.js App Router, tRPC, Drizzle ORM, TailwindCSS.

---

### Task 1: Update API Routers

**Files:**
- Modify: `src/server/api/routers/wallet.ts`
- Modify: `src/server/api/routers/transaction.ts`

**Step 1: Ensure `getWallet` fetches both wallets**
In `src/server/api/routers/wallet.ts`, locate the `getWallet` procedure.
Find the `recentTransactions` query.
Add `wallet` and `toWallet` columns to the `with` object:

```typescript
      // Get recent transactions (exclude soft-deleted)
      const recentTransactions = await db.query.transaction.findMany({
        where: and(
          eq(transactionSchema.walletId, input.id),
          isNull(transactionSchema.deletedAt),
        ),
        orderBy: [desc(transactionSchema.date), desc(transactionSchema.createdAt)],
        limit: 20,
        with: {
          wallet: {
            columns: {
              id: true,
              name: true,
            },
          },
          toWallet: {
            columns: {
              id: true,
              name: true,
            },
          },
          category: {
            columns: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });
```

**Step 2: Ensure `getTransactions` fetches `toWallet`**
In `src/server/api/routers/transaction.ts`, locate `getTransactions`. It currently fetches `wallet`, `category`, and `createdBy`. Ensure it also fetches `toWallet`:

```typescript
        with: {
          wallet: {
            columns: {
              id: true,
              name: true,
            },
          },
          toWallet: {
            columns: {
              id: true,
              name: true,
            },
          },
// ... (rest remains the same)
```

**Step 3: Commit**
```bash
git add src/server/api/routers/wallet.ts src/server/api/routers/transaction.ts
git commit -m "feat(api): include wallet and toWallet relations in transaction queries"
```

---

### Task 2: Enhance TransactionRow Component

**Files:**
- Modify: `src/components/shared/TransactionRow.tsx`

**Step 1: Update Props and UI**
Add `walletContext` and `line-clamp-1` for long strings.

```tsx
interface TransactionRowProps {
  transaction: {
    id: string;
    name: string;
    category: string;
    categoryIcon?: string;
    categoryColor?: string;
    date: string;
    amount: number;
    type: "income" | "expense" | "transfer_debit" | "transfer_credit";
    authorName?: string;
    walletContext?: string;
  };
  onClick?: () => void;
}
```

Update the subtitle render logic:
```tsx
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {transaction.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
          {transaction.authorName ? `${transaction.authorName} · ` : ""}
          {transaction.category}
          {transaction.walletContext ? ` · ${transaction.walletContext}` : ""}
          {` · ${transaction.date}`}
        </p>
      </div>
```

**Step 2: Commit**
```bash
git add src/components/shared/TransactionRow.tsx
git commit -m "feat(ui): add walletContext support to TransactionRow"
```

---

### Task 3: Apply Data Mapping in Pages

**Files:**
- Modify: `src/app/transactions/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/wallets/[id]/page.tsx`

**Step 1: Create a unified helper function**
Since we're mapping the same thing in 3 places, let's create a helper in `src/lib/formatIDR.ts` (or create `src/lib/transaction-helpers.ts` since formatIDR is unrelated).
Create: `src/lib/transaction-helpers.ts`
```typescript
export function getWalletContext(
  type: string,
  wallet?: { name: string } | null,
  toWallet?: { name: string } | null
): string {
  if (type === "transfer") {
    if (wallet && toWallet) {
      return `${wallet.name} -> ${toWallet.name}`;
    }
    return "Transfer";
  }
  return wallet?.name || "Dompet";
}
```

**Step 2: Apply to `transactions/page.tsx`**
Import `getWalletContext`.
Update mapping inside `transformedTransactions`:
```typescript
      type,
      walletContext: getWalletContext(tx.type, tx.wallet, tx.toWallet),
      authorName: tx.createdBy?.name,
```

**Step 3: Apply to `dashboard/page.tsx`**
Import `getWalletContext`.
Update mapping inside `recentTransactions`:
```typescript
        type,
        walletContext: getWalletContext(tx.type, tx.wallet as any, tx.toWallet as any),
        authorName: tx.createdBy?.name,
```

**Step 4: Apply to `wallets/[id]/page.tsx`**
Import `getWalletContext`.
Update mapping inside `mappedTransactions`:
```typescript
    amount: parseFloat(tx.amount),
    type: tx.type as "income" | "expense" | "transfer_debit" | "transfer_credit",
    walletContext: getWalletContext(tx.type, tx.wallet as any, tx.toWallet as any),
    authorName: tx.createdBy?.name,
```

**Step 5: Commit**
```bash
git add src/lib/transaction-helpers.ts src/app/transactions/page.tsx src/app/dashboard/page.tsx src/app/wallets/\[id\]/page.tsx
git commit -m "feat(ui): display wallet context in transaction lists"
```
