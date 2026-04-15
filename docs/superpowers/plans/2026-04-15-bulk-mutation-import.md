# Bulk Bank Mutation Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bulk transaction import feature that scans bank/e-wallet mutation screenshots via AI, shows parsed transactions on a review screen, and saves them all at once.

**Architecture:** New AI tRPC mutation for multi-row parsing + new bulk create transaction mutation + new full-page review screen at `/transactions/import` with in-memory state managed via React Context. Entry point is a new "Impor Mutasi" option in the existing InputMethodDrawer.

**Tech Stack:** Next.js App Router, tRPC, Groq SDK (Llama 4 Scout), React Context + useReducer, shadcn/ui components, Drizzle ORM

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/import-mutation/import-mutation-context.tsx` | React Context + useReducer for in-memory parsed transactions state |
| `src/components/import-mutation/import-mutation-card.tsx` | Single transaction card in the review list |
| `src/app/transactions/import/page.tsx` | Full-page review screen with list + sticky save button |
| `src/app/transactions/import/layout.tsx` | Layout wrapper providing ImportMutationProvider |

### Modified Files
| File | Change |
|------|--------|
| `src/server/api/routers/ai.ts` | Add `scanBankMutation` mutation |
| `src/server/api/routers/transaction.ts` | Add `createBulkTransactions` mutation |
| `src/components/transaction/InputMethodDrawer.tsx` | Add "Impor Mutasi" option |
| `src/components/transaction/TransactionManager.tsx` | Add scanBankMutation call + navigation to `/transactions/import` |

---

## Task 1: Add `scanBankMutation` to AI Router

**Files:**
- Modify: `src/server/api/routers/ai.ts`

- [ ] **Step 1: Add the Zod schema and mutation**

Add this after the existing `receiptItemsSchema` (line 39) and before `export const aiRouter`:

```typescript
const bankMutationTransactionSchema = z.object({
  name: z.string(),
  amount: z.number(),
  date: z.string(),
  type: z.enum(["income", "expense"]),
  notes: z.string(),
});

const bankMutationSchema = z.object({
  success: z.boolean(),
  transactions: z.array(bankMutationTransactionSchema),
});
```

Then add the `scanBankMutation` mutation inside `aiRouter` (after `scanReceiptItems`, before the closing `})`):

```typescript
  scanBankMutation: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const groq = new Groq({ apiKey: env.GROQ_API_KEY });

      const systemPrompt = `You are a bank/e-wallet mutation statement parser for an Indonesian personal finance app.
Analyze the provided image of a bank or e-wallet mutation/history screenshot and extract ALL transaction rows.

You must output strict JSON matching this exact schema:
{
  "success": boolean,
  "transactions": [
    {
      "name": string,
      "amount": number,
      "date": "YYYY-MM-DD",
      "type": "income" | "expense",
      "notes": string
    }
  ]
}

RULES:
1. Extract EVERY transaction row visible in the image. Do NOT skip any rows.
2. "name": The merchant name, transfer sender/receiver, or description of the transaction.
3. "amount": The transaction amount as a WHOLE number in IDR (no decimals).

CRITICAL - Indonesian Number Format:
- Indonesian formats use DOTS (.) as THOUSAND separators, NOT decimal points.
- "72.000" means 72000, NOT 72.0.
- "1.500.000" means 1500000.
- Remove ALL dots from amounts before parsing.
- Comma (,) is used as decimal separator but for IDR amounts it is extremely rare. If you see "72.000,50" treat it as 72000.

4. "date": Parse the transaction date into YYYY-MM-DD format.
- Handle common Indonesian date formats: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY (Indonesian month names: Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des).
- If the year is not visible, assume the current year 2026.
- If the date cannot be parsed, use "2026-01-01".

5. "type": Determine based on these rules:
- CREDIT entries (money IN): incoming transfers (TRF MASUK, TRANSFER CR, top-up, received money) → "income"
- DEBIT entries (money OUT): payments, outgoing transfers (TRF KELUAR, TRANSFER DB, purchases, withdrawals) → "expense"
- Keywords for "income": CR, Credit, Masuk, Terima, Top Up, Refund, Cashback
- Keywords for "expense": DB, Debit, Keluar, Bayar, Beli, Pembayaran, Tarik, Transfer
- If ambiguous, default to "expense".

6. "notes": Include any additional details like reference numbers, transaction IDs, or remarks visible on the row. If none, use empty string "".

7. SKIP: header rows, "SALDO" / "BALANCE" rows, date-only rows with no transaction, and rows that are clearly not transactions.

8. The image may come from: BCA, BRI, Mandiri, BNI, CIMB, Permata, Danamon, GoPay, OVO, DANA, ShopeePay, LinkAja, or any other Indonesian bank/e-wallet app.

9. If the image is not a readable mutation/bank statement, set success to false and transactions to empty array.`;

      try {
        const result = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Please parse this bank/e-wallet mutation screenshot into individual transactions." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.imageBase64}`,
                  },
                },
              ],
            },
          ],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0,
          response_format: { type: "json_object" },
        });

        const textResponse = result.choices[0]?.message?.content || "";
        const parsed = JSON.parse(textResponse);
        const validated = bankMutationSchema.parse(parsed);

        if (!validated.success || validated.transactions.length === 0) {
          return {
            success: false as const,
            transactions: [],
            error: "Tidak ada transaksi terdeteksi dari gambar",
          };
        }

        return {
          success: true as const,
          transactions: validated.transactions,
        };
      } catch (error) {
        console.error("Groq Bank Mutation error:", error);
        return {
          success: false as const,
          transactions: [],
          error: "Gagal memindai mutasi rekening",
        };
      }
    }),
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors related to `ai.ts`. There may be pre-existing errors in other files — those are fine.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/ai.ts
git commit -m "feat(ai): add scanBankMutation for bulk mutation parsing"
```

---

## Task 2: Add `createBulkTransactions` to Transaction Router

**Files:**
- Modify: `src/server/api/routers/transaction.ts`

- [ ] **Step 1: Add the bulk create mutation**

Add this at the end of the `transactionRouter` object (before the final closing `};` but after `deleteTransaction` or whatever is the last procedure). Find the last procedure in the router and add after it:

```typescript
  createBulkTransactions: protectedProcedure
    .input(
      z.object({
        transactions: z.array(
          z.object({
            type: z.enum(["income", "expense"]),
            amount: z.number().positive(),
            name: z.string().min(1).max(255),
            notes: z.string().max(1000).optional(),
            date: z.string().datetime(),
            categoryId: z.string().uuid(),
            walletId: z.string().uuid(),
          }),
        ),
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

      if (input.transactions.length === 0) {
        throw new Error("No transactions to create");
      }

      if (input.transactions.length > 100) {
        throw new Error("Maximum 100 transactions per bulk import");
      }

      // Verify all wallets belong to the workspace
      const walletIds = [...new Set(input.transactions.map((t) => t.walletId))];
      const wallets = await db.query.wallet.findMany({
        where: and(
          inArray(walletSchema.id, walletIds),
          eq(walletSchema.workspaceId, input.workspaceId),
        ),
      });

      if (wallets.length !== walletIds.length) {
        throw new Error("One or more wallets not found or not in workspace");
      }

      // Verify all categories belong to the workspace
      const categoryIds = [...new Set(input.transactions.map((t) => t.categoryId))];
      const categories = await db.query.category.findMany({
        where: and(
          inArray(categorySchema.id, categoryIds),
          eq(categorySchema.workspaceId, input.workspaceId),
        ),
      });

      if (categories.length !== categoryIds.length) {
        throw new Error("One or more categories not found or not in workspace");
      }

      // Create a map for quick wallet lookup during balance updates
      const walletMap = new Map(wallets.map((w) => [w.id, w]));

      // Execute all inserts and balance updates in a single DB transaction
      const result = await db.transaction(async (tx) => {
        let created = 0;

        for (const item of input.transactions) {
          const transactionId = crypto.randomUUID();
          const amountDb = (item.amount / 100).toFixed(2);

          await tx.insert(transaction).values({
            id: transactionId,
            type: item.type,
            amount: amountDb,
            name: item.name,
            notes: item.notes ?? null,
            date: new Date(item.date),
            categoryId: item.categoryId,
            walletId: item.walletId,
            workspaceId: input.workspaceId,
            createdBy: ctx.session.user.id,
          });

          // Fetch fresh wallet balance inside the transaction
          const currentWallet = await tx.query.wallet.findFirst({
            where: eq(walletSchema.id, item.walletId),
          });

          if (!currentWallet) throw new Error(`Wallet ${item.walletId} not found during update`);

          const currentBalance = Number(currentWallet.balance);
          const amountNum = Number(amountDb);

          if (item.type === "income") {
            await tx
              .update(walletSchema)
              .set({
                balance: (currentBalance + amountNum).toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(walletSchema.id, item.walletId));
          } else {
            await tx
              .update(walletSchema)
              .set({
                balance: (currentBalance - amountNum).toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(walletSchema.id, item.walletId));
          }

          created++;
        }

        return created;
      });

      return { count: result };
    }),
```

Note: The `inArray` import already exists at line 2 of the file.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors related to `transaction.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/transaction.ts
git commit -m "feat(transaction): add createBulkTransactions mutation"
```

---

## Task 3: Create ImportMutation Context

**Files:**
- Create: `src/components/import-mutation/import-mutation-context.tsx`

- [ ] **Step 1: Create the context file**

```typescript
"use client";

import React, { createContext, useContext, useReducer, type ReactNode } from "react";

export interface ParsedTransaction {
  id: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: "income" | "expense";
  notes: string;
  walletId?: string;
  categoryId?: string;
}

interface ImportMutationState {
  transactions: ParsedTransaction[];
}

type ImportMutationAction =
  | { type: "SET_TRANSACTIONS"; transactions: ParsedTransaction[] }
  | { type: "UPDATE_TRANSACTION"; id: string; data: Partial<ParsedTransaction> }
  | { type: "REMOVE_TRANSACTION"; id: string };

const initialState: ImportMutationState = {
  transactions: [],
};

function importMutationReducer(
  state: ImportMutationState,
  action: ImportMutationAction,
): ImportMutationState {
  switch (action.type) {
    case "SET_TRANSACTIONS":
      return { transactions: action.transactions };
    case "UPDATE_TRANSACTION":
      return {
        transactions: state.transactions.map((t) =>
          t.id === action.id ? { ...t, ...action.data } : t,
        ),
      };
    case "REMOVE_TRANSACTION":
      return {
        transactions: state.transactions.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

interface ImportMutationContextType {
  state: ImportMutationState;
  dispatch: React.Dispatch<ImportMutationAction>;
  /** Check if a transaction has all required fields for saving */
  isValid: (t: ParsedTransaction) => boolean;
  /** Check if ALL transactions are valid (for enabling the save button) */
  allValid: () => boolean;
}

const ImportMutationContext = createContext<ImportMutationContextType | null>(null);

export function ImportMutationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(importMutationReducer, initialState);

  const isValid = (t: ParsedTransaction): boolean =>
    !!t.walletId && !!t.categoryId && t.amount > 0 && t.name.trim().length > 0;

  const allValid = (): boolean =>
    state.transactions.length > 0 && state.transactions.every(isValid);

  return (
    <ImportMutationContext.Provider value={{ state, dispatch, isValid, allValid }}>
      {children}
    </ImportMutationContext.Provider>
  );
}

export function useImportMutation() {
  const context = useContext(ImportMutationContext);
  if (!context) {
    throw new Error("useImportMutation must be used within ImportMutationProvider");
  }
  return context;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/import-mutation/import-mutation-context.tsx
git commit -m "feat(import-mutation): add ImportMutationProvider context"
```

---

## Task 4: Create Import Mutation Card Component

**Files:**
- Create: `src/components/import-mutation/import-mutation-card.tsx`

- [ ] **Step 1: Create the card component**

```typescript
"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { ParsedTransaction, useImportMutation } from "./import-mutation-context";
import { ArrowUpCircle, ArrowDownCircle, Check, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ImportMutationCardProps {
  transaction: ParsedTransaction;
  onEdit: (transaction: ParsedTransaction) => void;
}

export function ImportMutationCard({ transaction, onEdit }: ImportMutationCardProps) {
  const { isValid, dispatch } = useImportMutation();
  const valid = isValid(transaction);
  const isIncome = transaction.type === "income";

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: "REMOVE_TRANSACTION", id: transaction.id });
  };

  return (
    <Card
      className={cn(
        "relative cursor-pointer rounded-[20px] border p-4 transition-colors active:bg-muted/50",
        isIncome ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500"
      )}
      onClick={() => onEdit(transaction)}
    >
      <button
        onClick={handleRemove}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:bg-muted/80"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isIncome ? "bg-emerald-500/10" : "bg-red-500/10"
        )}>
          {isIncome ? (
            <ArrowDownCircle size={18} className="text-emerald-500" />
          ) : (
            <ArrowUpCircle size={18} className="text-red-500" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium leading-tight line-clamp-1">
            {transaction.name || "Tanpa nama"}
          </span>
          <span className="text-xs text-muted-foreground">
            {transaction.date
              ? format(new Date(transaction.date + "T00:00:00"), "dd MMM yyyy", { locale: idLocale })
              : "Tanggal tidak diketahui"}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={cn(
            "text-sm font-semibold",
            isIncome ? "text-emerald-500" : "text-red-500"
          )}>
            {isIncome ? "+" : "-"}Rp {(transaction.amount).toLocaleString("id-ID")}
          </span>
          {valid ? (
            <Check size={14} className="text-emerald-500" />
          ) : (
            <div className="flex items-center gap-0.5">
              <AlertTriangle size={12} className="text-amber-500" />
              <span className="text-[10px] text-amber-500">Lengkapi</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/import-mutation/import-mutation-card.tsx
git commit -m "feat(import-mutation): add ImportMutationCard component"
```

---

## Task 5: Create the Review Page and Layout

**Files:**
- Create: `src/app/transactions/import/layout.tsx`
- Create: `src/app/transactions/import/page.tsx`

- [ ] **Step 1: Create the layout wrapper**

Create `src/app/transactions/import/layout.tsx`:

```typescript
import { ImportMutationProvider } from "@/components/import-mutation/import-mutation-context";

export default function ImportMutationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ImportMutationProvider>{children}</ImportMutationProvider>;
}
```

- [ ] **Step 2: Create the review page**

Create `src/app/transactions/import/page.tsx`:

```typescript
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ImportMutationCard } from "@/components/import-mutation/import-mutation-card";
import {
  useImportMutation,
  type ParsedTransaction,
} from "@/components/import-mutation/import-mutation-context";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export default function ImportMutationPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const { state, dispatch, allValid } = useImportMutation();
  const [editingItem, setEditingItem] = useState<ParsedTransaction | null>(null);

  const createBulk = api.transaction.createBulkTransactions.useMutation();
  const utils = api.useUtils();

  const transactions = state.transactions;
  const canSave = allValid() && !createBulk.isPending;

  const handleEdit = (item: ParsedTransaction) => {
    setEditingItem(item);
  };

  const handleDrawerSave = (updatedData: Record<string, unknown>) => {
    if (!editingItem) return;

    dispatch({
      type: "UPDATE_TRANSACTION",
      id: editingItem.id,
      data: {
        name: (updatedData.name as string) || editingItem.name,
        amount: Number(updatedData.amount) || editingItem.amount,
        type: (updatedData.type as "income" | "expense") || editingItem.type,
        date: (updatedData.date as string) || editingItem.date,
        notes: (updatedData.notes as string) ?? editingItem.notes,
        walletId: (updatedData.wallet as { id: string })?.id || updatedData.walletId as string | undefined,
        categoryId: (updatedData.category as { id: string })?.id || updatedData.categoryId as string | undefined,
      },
    });
    setEditingItem(null);
  };

  const handleSaveAll = async () => {
    if (!canSave || !workspaceId) return;

    const bulkInput = transactions.map((t) => ({
      type: t.type,
      amount: t.amount * 100, // Convert to cents
      name: t.name.trim(),
      notes: t.notes || undefined,
      date: new Date(t.date + "T00:00:00Z").toISOString(),
      walletId: t.walletId!,
      categoryId: t.categoryId!,
    }));

    try {
      const result = await createBulk.mutateAsync({
        transactions: bulkInput,
        workspaceId,
      });

      await Promise.all([
        utils.transaction.getTransactions.invalidate(),
        utils.transaction.getDashboardSummary.invalidate(),
        utils.wallet.getWallets.invalidate(),
        utils.wallet.getWallet.invalidate(),
      ]);

      toast.success(`${result.count} transaksi berhasil disimpan`);
      router.push("/transactions");
    } catch (error) {
      console.error("Bulk save error:", error);
      toast.error("Gagal menyimpan transaksi");
    }
  };

  // Map editing item to AddTransactionSheet initialData format
  const drawerInitialData = editingItem
    ? {
        ...editingItem,
        wallet: editingItem.walletId ? { id: editingItem.walletId } : null,
        category: editingItem.categoryId ? { id: editingItem.categoryId } : null,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-5 py-4">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors active:bg-muted"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <h1 className="text-lg font-semibold">Impor Mutasi</h1>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-white">
            {transactions.length}
          </span>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-28">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <span className="text-sm">Tidak ada transaksi untuk diimpor</span>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="mt-2 rounded-full"
            >
              Kembali
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <ImportMutationCard
                key={t.id}
                transaction={t}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      {transactions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background px-5 py-4">
          <div className="mx-auto max-w-lg">
            <Button
              onClick={handleSaveAll}
              className="h-12 w-full rounded-full bg-primary text-base font-semibold text-white hover:bg-primary"
              disabled={!canSave}
            >
              {createBulk.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                `Simpan Semua (${transactions.length})`
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Edit Drawer */}
      <AddTransactionSheet
        open={!!editingItem}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingItem(null);
        }}
        initialData={drawerInitialData}
        onSave={handleDrawerSave}
      />
    </div>
  );
}
```

**Important:** The `AddTransactionSheet` component currently does not expose an `onSave` callback. Task 6 will add that prop.

- [ ] **Step 3: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: There WILL be a type error because `AddTransactionSheet` doesn't accept `onSave` prop yet. This is expected — Task 6 fixes it.

- [ ] **Step 4: Commit (after Task 6 resolves the type error)**

---

## Task 6: Add `onSave` Callback to AddTransactionSheet

**Files:**
- Modify: `src/components/transaction/AddTransactionSheet.tsx`

- [ ] **Step 1: Add `onSave` prop to the component**

In `src/components/transaction/AddTransactionSheet.tsx`, modify the interface (around line 37):

Change from:
```typescript
interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Record<string, unknown> | null; // The full transaction object from DB
}
```

To:
```typescript
interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Record<string, unknown> | null; // The full transaction object from DB
  /** Optional callback after successful save, receiving the saved transaction data */
  onSave?: (data: Record<string, unknown>) => void;
}
```

Then update the function signature (around line 43) to destructure the new prop:

Change from:
```typescript
export function AddTransactionSheet({
  open,
  onOpenChange,
  initialData,
}: AddTransactionSheetProps) {
```

To:
```typescript
export function AddTransactionSheet({
  open,
  onOpenChange,
  initialData,
  onSave,
}: AddTransactionSheetProps) {
```

Then in the `handleSubmit` function, right after the `resetForm()` call (around line 299) and before `onOpenChange(false)`, add:

```typescript
      if (onSave) {
        onSave({
          type,
          amount,
          name: (name || "").trim(),
          notes: (note || "").trim(),
          date,
          walletId,
          categoryId,
          budgetId,
        });
      }
```

This should be placed so the full block looks like:

```typescript
      resetForm();

      if (onSave) {
        onSave({
          type,
          amount,
          name: (name || "").trim(),
          notes: (note || "").trim(),
          date,
          walletId,
          categoryId,
          budgetId,
        });
      }

      onOpenChange(false);
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit Tasks 5 + 6 together**

```bash
git add src/app/transactions/import/ src/components/transaction/AddTransactionSheet.tsx src/components/import-mutation/
git commit -m "feat(import-mutation): add review page, card component, and onSave callback"
```

---

## Task 7: Add "Impor Mutasi" Entry Point to InputMethodDrawer and TransactionManager

**Files:**
- Modify: `src/components/transaction/InputMethodDrawer.tsx`
- Modify: `src/components/transaction/TransactionManager.tsx`

- [ ] **Step 1: Update InputMethodDrawer**

In `src/components/transaction/InputMethodDrawer.tsx`:

1. Add `FileStack` to the lucide-react import (line 4):
```typescript
import { PenLine, Mic, MessageSquare, ScanLine, Camera, ImagePlus, Loader2, Scissors, FileStack } from "lucide-react";
```

2. Update the `InputMethodDrawerProps` interface (line 15-22) — add the new callback props:
```typescript
interface InputMethodDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: "manual" | "voice" | "text" | "scan" | "mutation") => void;
  isScanning?: boolean;
  onCameraClick?: () => void;
  onGalleryClick?: () => void;
  isScanningMutation?: boolean;
  onMutationCameraClick?: () => void;
  onMutationGalleryClick?: () => void;
}
```

3. Update the destructured props (line 24-31):
```typescript
export function InputMethodDrawer({
  open,
  onOpenChange,
  onSelectMethod,
  isScanning,
  onCameraClick,
  onGalleryClick,
  isScanningMutation,
  onMutationCameraClick,
  onMutationGalleryClick,
}: InputMethodDrawerProps) {
```

4. Update the `handleSelect` function (line 32) to include `"mutation"`:
```typescript
  const handleSelect = (method: "manual" | "voice" | "text" | "scan" | "mutation") => {
    if (method === "scan" || method === "mutation") {
      onSelectMethod(method);
      return; // Keep drawer open to show loading spinner
    }
    onOpenChange(false);
    setTimeout(() => onSelectMethod(method), 300);
  };
```

5. Add the "Impor Mutasi" button inside the Block 2 section (after the Split Bill link, before the closing `</div>` of Block 2). The current Block 2 has only Split Bill. Add Impor Mutasi as a second item in the same block:

Replace the entire Block 2 section (lines 137-151):
```typescript
          {/* Block 2: Utilities */}
          <div className="flex flex-col rounded-2xl border bg-card overflow-hidden shadow-sm">
            <Link
              href="/split-bill/new/items"
              onClick={() => onOpenChange(false)}
              className={cn(menuItemClass, "border-b border-border/50")}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                <Scissors size={24} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">Split Bill</span>
                <span className="text-xs text-muted-foreground">Bagi tagihan dengan teman</span>
              </div>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(menuItemClass, "relative text-left w-full")}
                  disabled={isScanningMutation}
                >
                  {isScanningMutation && (
                    <div className="absolute inset-0 bg-background/50 rounded-none flex items-center justify-center z-10 backdrop-blur-[1px]">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  )}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                    <FileStack size={24} className="text-muted-foreground" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-sm">Impor Mutasi</span>
                    <span className="text-xs text-muted-foreground">Scan mutasi bank & e-wallet</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 rounded-xl z-[100]">
                <DropdownMenuItem
                  onClick={() => {
                    onMutationCameraClick?.();
                    handleSelect("mutation");
                  }}
                  className="gap-2 cursor-pointer py-2.5"
                >
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span>Ambil Foto</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onMutationGalleryClick?.();
                    handleSelect("mutation");
                  }}
                  className="gap-2 cursor-pointer py-2.5"
                >
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <span>Pilih dari Galeri</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
```

- [ ] **Step 2: Update TransactionManager**

In `src/components/transaction/TransactionManager.tsx`:

1. Add `useRouter` import from `next/navigation` (add to line 1 area):
```typescript
import { useRouter } from "next/navigation";
```

2. Add router inside the component (after line 24, before `const [smartMode, ...`):
```typescript
  const router = useRouter();
```

3. Add the `scanBankMutation` alongside existing `scanMutation` (after line 34):
```typescript
  const scanBankMutation = api.ai.scanBankMutation.useMutation();
```

4. Add hidden file input refs for mutation scanning (after line 33, `galleryInputRef`):
```typescript
  const mutationCameraInputRef = React.useRef<HTMLInputElement>(null);
  const mutationGalleryInputRef = React.useRef<HTMLInputElement>(null);
```

5. Add the `handleMutationFileChange` function (after `handleFileChange`, around line 63):
```typescript
  const handleMutationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedBase64 = await compressImage(file);
      const result = await scanBankMutation.mutateAsync({
        imageBase64: compressedBase64,
        mimeType: file.type || "image/jpeg",
      });

      if (result.success && result.transactions.length > 0) {
        // Navigate to import page with parsed data via sessionStorage
        const importData = result.transactions.map((t) => ({
          ...t,
          id: crypto.randomUUID(),
          walletId: undefined,
          categoryId: undefined,
        }));
        sessionStorage.setItem("importMutationData", JSON.stringify(importData));
        onOpenChange(false);
        router.push("/transactions/import");
      } else {
        alert(result.error || "Tidak ada transaksi terdeteksi dari gambar");
      }
    } catch (error) {
      console.error("Bank mutation scan error:", error);
      alert("Terjadi kesalahan saat memindai mutasi");
    } finally {
      if (mutationCameraInputRef.current) mutationCameraInputRef.current.value = "";
      if (mutationGalleryInputRef.current) mutationGalleryInputRef.current.value = "";
    }
  };
```

6. Update `handleSelectMethod` to handle `"mutation"` (update line 65-76):
```typescript
  const handleSelectMethod = (method: "manual" | "voice" | "text" | "scan" | "mutation") => {
    if (method === "manual") {
      setInitialData(null);
      setActiveView("add");
    } else if (method === "voice" || method === "text") {
      setSmartMode(method);
      setActiveView("smart");
    } else if (method === "scan" || method === "mutation") {
      // InputMethodDrawer handles opening the dropdown.
      // The dropdown options trigger the inputs below.
    }
  };
```

7. Pass new props to `InputMethodDrawer` (update lines 113-124):
```typescript
      <InputMethodDrawer
        open={activeView === "input-method"}
        onOpenChange={(isOpen) => {
          if (!isOpen && activeView === "input-method") {
            handleManagerClose();
          }
        }}
        onSelectMethod={handleSelectMethod}
        isScanning={scanMutation.isPending}
        onCameraClick={() => cameraInputRef.current?.click()}
        onGalleryClick={() => galleryInputRef.current?.click()}
        isScanningMutation={scanBankMutation.isPending}
        onMutationCameraClick={() => mutationCameraInputRef.current?.click()}
        onMutationGalleryClick={() => mutationGalleryInputRef.current?.click()}
      />
```

8. Add hidden file inputs for mutation scanning (before the closing `</>`, after the existing hidden inputs):
```typescript
      {/* Hidden file inputs for bank mutation scanning */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={mutationCameraInputRef}
        onChange={handleMutationFileChange}
      />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={mutationGalleryInputRef}
        onChange={handleMutationFileChange}
      />
```

- [ ] **Step 3: Update the import page to read from sessionStorage**

In `src/app/transactions/import/page.tsx`, add a `useEffect` at the top of the component to load data from sessionStorage:

Add this import at the top:
```typescript
import React, { useState, useEffect } from "react";
```

Add this effect inside the component, right after `const [editingItem, ...`:
```typescript
  // Load parsed transactions from sessionStorage (set by TransactionManager)
  useEffect(() => {
    const stored = sessionStorage.getItem("importMutationData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        dispatch({ type: "SET_TRANSACTIONS", transactions: parsed });
        sessionStorage.removeItem("importMutationData");
      } catch {
        // Invalid data, ignore
      }
    }
  }, [dispatch]);
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/transaction/InputMethodDrawer.tsx src/components/transaction/TransactionManager.tsx src/app/transactions/import/page.tsx
git commit -m "feat(import-mutation): add Impor Mutasi entry point and scan flow"
```

---

## Task 8: End-to-End Smoke Test

**Files:** None (manual testing)

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

- [ ] **Step 2: Test the full flow manually**

1. Open the app on mobile or mobile-width browser
2. Tap the "+" FAB button
3. Verify "Impor Mutasi" option appears in Block 2 alongside Split Bill
4. Tap "Impor Mutasi" → verify dropdown shows "Ambil Foto" and "Pilih dari Galeri"
5. Select a test bank mutation screenshot
6. Verify loading spinner appears
7. Verify navigation to `/transactions/import` page
8. Verify parsed transactions appear as cards with correct income/expense coloring
9. Tap a card → verify AddTransactionSheet opens pre-filled
10. Fill in wallet and category → save → verify card updates with checkmark
11. Remove a card via X button
12. Tap "Simpan Semua" (when all valid) → verify transactions saved and redirected to /transactions

- [ ] **Step 3: Verify transactions appear in the transaction list**

Check the transactions page to confirm all imported transactions show up correctly with proper amounts, types, dates, and categories.

---

## Self-Review Checklist

- [x] **Spec coverage:** All spec requirements have corresponding tasks (AI mutation: Task 1, bulk create: Task 2, context: Task 3, card UI: Task 4, review page: Task 5, edit flow: Task 6, entry point: Task 7, testing: Task 8)
- [x] **Placeholder scan:** No TBD/TODO/vague steps. All code is complete.
- [x] **Type consistency:** `ParsedTransaction` type matches across context, card, and page. `onSave` callback data format matches what `handleDrawerSave` expects. Amount in cents conversion consistent (`amount * 100` in page, `/ 100` in backend).
