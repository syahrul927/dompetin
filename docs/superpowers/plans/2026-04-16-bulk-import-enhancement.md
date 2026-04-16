# Bulk Import Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the bulk import feature with single wallet selection, AI-powered category mapping using default category keys, and simplified edit flow.

**Architecture:** Modify existing files only. Update AI prompt to accept categories and return `categoryKey`. Replace per-item wallet with global wallet selector on review screen. Resolve default category keys to real DB IDs at save time.

**Tech Stack:** tRPC, Groq SDK, React Context, shadcn/ui WalletSelectDrawer

---

## File Structure

### Modified Files
| File | Change |
|------|--------|
| `src/components/import-mutation/import-mutation-context.tsx` | Replace `walletId`/`categoryId` with `categoryKey`, update validation |
| `src/components/import-mutation/import-mutation-card.tsx` | Show category name, remove wallet validation display |
| `src/app/transactions/import/page.tsx` | Add global wallet selector, update save flow with category resolution |
| `src/server/api/routers/ai.ts` | Update `scanBankMutation` to accept categories and return `categoryKey` |
| `src/components/transaction/TransactionManager.tsx` | Pass DEFAULT_CATEGORIES to scanBankMutation, update mapping |

---

## Task 1: Update ImportMutationContext

**Files:**
- Modify: `src/components/import-mutation/import-mutation-context.tsx`

- [ ] **Step 1: Update ParsedTransaction and validation**

Replace the entire file content with:

```typescript
"use client";

import React, { createContext, useContext, useReducer, type ReactNode } from "react";

export interface ParsedTransaction {
  id: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: "income" | "expense";
  categoryKey: string; // DEFAULT_CATEGORIES key, e.g. "makanan-minuman"
  notes: string;
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
  /** Check if a single transaction has all required fields */
  isValid: (t: ParsedTransaction) => boolean;
  /** Check if ALL transactions are valid */
  allValid: () => boolean;
}

const ImportMutationContext = createContext<ImportMutationContextType | null>(null);

export function ImportMutationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(importMutationReducer, initialState);

  const isValid = (t: ParsedTransaction): boolean =>
    !!t.categoryKey && t.amount > 0 && t.name.trim().length > 0;

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
Expected: Errors in import-mutation-card.tsx and page.tsx (they reference removed fields). This is expected — Tasks 2 and 3 fix them.

- [ ] **Step 3: Commit**

```bash
git add src/components/import-mutation/import-mutation-context.tsx
git commit -m "refactor(import-mutation): replace walletId/categoryId with categoryKey in ParsedTransaction"
```

---

## Task 2: Update ImportMutationCard

**Files:**
- Modify: `src/components/import-mutation/import-mutation-card.tsx`

- [ ] **Step 1: Update card to show category name**

Replace the entire file content with:

```typescript
"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { useImportMutation, type ParsedTransaction } from "./import-mutation-context";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { ArrowUpCircle, ArrowDownCircle, Check, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

function getCategoryName(categoryKey: string): string {
  const cat = DEFAULT_CATEGORIES.find((c) => c.key === categoryKey);
  return cat?.name ?? "Lainnya";
}

function isLainnya(categoryKey: string): boolean {
  return categoryKey === "lainnya-expense" || categoryKey === "lainnya-income";
}

interface ImportMutationCardProps {
  transaction: ParsedTransaction;
  onEdit: (transaction: ParsedTransaction) => void;
}

export function ImportMutationCard({ transaction, onEdit }: ImportMutationCardProps) {
  const { isValid, dispatch } = useImportMutation();
  const valid = isValid(transaction);
  const isIncome = transaction.type === "income";
  const categoryName = getCategoryName(transaction.categoryKey);
  const isFallback = isLainnya(transaction.categoryKey);

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
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {transaction.date
                ? format(new Date(transaction.date + "T00:00:00"), "dd MMM yyyy", { locale: idLocale })
                : "Tanggal tidak diketahui"}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className={cn(
              "text-[10px] font-medium",
              isFallback ? "text-amber-500" : "text-muted-foreground"
            )}>
              {categoryName}
            </span>
          </div>
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
Expected: Errors only in page.tsx (Task 3 fixes it).

- [ ] **Step 3: Commit**

```bash
git add src/components/import-mutation/import-mutation-card.tsx
git commit -m "refactor(import-mutation): show category name in card, remove wallet validation"
```

---

## Task 3: Update AI Router — scanBankMutation

**Files:**
- Modify: `src/server/api/routers/ai.ts`

- [ ] **Step 1: Update Zod schemas and mutation**

In `src/server/api/routers/ai.ts`, find the `bankMutationTransactionSchema` (around line 41-47). Replace it and `bankMutationSchema`:

Change from:
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

To:
```typescript
const bankMutationTransactionSchema = z.object({
  name: z.string(),
  amount: z.number(),
  date: z.string(),
  type: z.enum(["income", "expense"]),
  categoryKey: z.string(),
  notes: z.string(),
});

const bankMutationSchema = z.object({
  success: z.boolean(),
  transactions: z.array(bankMutationTransactionSchema),
});
```

Then update the `scanBankMutation` input to accept categories. Find:

```typescript
  scanBankMutation: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.string(),
      }),
    )
```

Replace with:
```typescript
  scanBankMutation: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.string(),
        availableCategories: z.array(
          z.object({
            key: z.string(),
            name: z.string(),
            type: z.string(),
          }),
        ),
      }),
    )
```

Then update the system prompt. Find the entire `const systemPrompt = \`You are a bank...` block (starts around line 274) and replace with:

```typescript
      const categoryList = input.availableCategories
        .map((c) => `- "${c.key}" (${c.name}, ${c.type})`)
        .join("\n");

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
      "categoryKey": string,
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

6. "categoryKey": Map each transaction to the BEST matching category from this list. Use the "key" value exactly as provided.
${categoryList}

For expense transactions, only use keys where type is "expense". For income transactions, only use keys where type is "income".
If you cannot find a good match, use "lainnya-expense" for expenses or "lainnya-income" for income.

7. "notes": Include any additional details like reference numbers, transaction IDs, or remarks visible on the row. If none, use empty string "".

8. SKIP: header rows, "SALDO" / "BALANCE" rows, date-only rows with no transaction, and rows that are clearly not transactions.

9. The image may come from: BCA, BRI, Mandiri, BNI, CIMB, Permata, Danamon, GoPay, OVO, DANA, ShopeePay, LinkAja, or any other Indonesian bank/e-wallet app.

10. If the image is not a readable mutation/bank statement, set success to false and transactions to empty array.`;
```

The rest of the mutation (the `try/catch` block, the Groq call, the validation, and the return) stays the same — no changes needed there.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: Errors only in TransactionManager (it doesn't pass `availableCategories` yet — Task 4 fixes it).

- [ ] **Step 3: Commit**

```bash
git add src/server/api/routers/ai.ts
git commit -m "feat(ai): update scanBankMutation to accept categories and return categoryKey"
```

---

## Task 4: Update TransactionManager

**Files:**
- Modify: `src/components/transaction/TransactionManager.tsx`

- [ ] **Step 1: Pass DEFAULT_CATEGORIES and update mapping**

In `src/components/transaction/TransactionManager.tsx`:

1. Add import for DEFAULT_CATEGORIES at the top (add near other imports):
```typescript
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
```

2. Update `handleMutationFileChange`. Find the `scanBankMutation.mutateAsync` call (around line 77):

Change from:
```typescript
      const result = await scanBankMutation.mutateAsync({
        imageBase64: compressedBase64,
        mimeType: file.type || "image/jpeg",
      });

      if (result.success && result.transactions.length > 0) {
        const importData = result.transactions.map((t) => ({
          ...t,
          id: crypto.randomUUID(),
          walletId: undefined,
          categoryId: undefined,
        }));
```

To:
```typescript
      const result = await scanBankMutation.mutateAsync({
        imageBase64: compressedBase64,
        mimeType: file.type || "image/jpeg",
        availableCategories: DEFAULT_CATEGORIES.map((c) => ({
          key: c.key,
          name: c.name,
          type: c.type,
        })),
      });

      if (result.success && result.transactions.length > 0) {
        const importData = result.transactions.map((t) => ({
          ...t,
          id: crypto.randomUUID(),
        }));
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: Errors only in page.tsx (Task 5 fixes it).

- [ ] **Step 3: Commit**

```bash
git add src/components/transaction/TransactionManager.tsx
git commit -m "refactor(import-mutation): pass DEFAULT_CATEGORIES to scanBankMutation"
```

---

## Task 5: Update Review Page — Global Wallet + Category Resolution

**Files:**
- Modify: `src/app/transactions/import/page.tsx`

- [ ] **Step 1: Rewrite the review page**

Replace the entire file content with:

```typescript
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import { ImportMutationCard } from "@/components/import-mutation/import-mutation-card";
import {
  useImportMutation,
  type ParsedTransaction,
} from "@/components/import-mutation/import-mutation-context";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { WalletSelectDrawer } from "@/components/transaction/WalletSelectDrawer";
import { FormRow } from "@/components/shared/FormRow";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { isDefaultCategoryId } from "@/lib/default-categories";

export default function ImportMutationPage() {
  const router = useRouter();
  const { workspaceId } = useActiveWorkspace();
  const { state, dispatch, allValid } = useImportMutation();
  const [editingItem, setEditingItem] = useState<ParsedTransaction | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState("");

  const createBulk = api.transaction.createBulkTransactions.useMutation();
  const resolveCategory = api.category.resolveCategory.useMutation();
  const utils = api.useUtils();

  // Fetch wallets for display name
  const { data: wallets } = api.wallet.getWallets.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const selectedWalletName = wallets?.find((w) => w.id === selectedWalletId)?.name;

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

  const transactions = state.transactions;
  const canSave = !!selectedWalletId && allValid() && !createBulk.isPending;

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
      },
    });
    setEditingItem(null);
  };

  const handleSaveAll = async () => {
    if (!canSave || !workspaceId) return;

    try {
      // Resolve all unique categoryKeys to real DB categoryIds
      const uniqueKeys = [...new Set(transactions.map((t) => t.categoryKey))];
      const categoryMap = new Map<string, string>();

      for (const key of uniqueKeys) {
        const prefixedId = `default:${key}`;
        const resolved = await resolveCategory.mutateAsync({
          categoryId: prefixedId,
          workspaceId,
        });
        categoryMap.set(key, resolved.id);
      }

      // Build bulk input
      const bulkInput = transactions.map((t) => ({
        type: t.type,
        amount: t.amount * 100, // Convert to cents
        name: t.name.trim(),
        notes: t.notes || undefined,
        date: new Date(t.date + "T00:00:00Z").toISOString(),
        walletId: selectedWalletId,
        categoryId: categoryMap.get(t.categoryKey)!,
      }));

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
        wallet: selectedWalletId ? { id: selectedWalletId } : null,
        category: editingItem.categoryKey
          ? { id: `default:${editingItem.categoryKey}` }
          : null,
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
        {/* Global Wallet Selector */}
        {transactions.length > 0 && (
          <div className="mb-4">
            <WalletSelectDrawer
              value={selectedWalletId}
              onChange={setSelectedWalletId}
              workspaceId={workspaceId}
            >
              <div className={cn(
                "flex items-center gap-3 rounded-[16px] border p-3 transition-colors",
                !selectedWalletId ? "border-amber-500/50 bg-amber-500/5" : "border-border"
              )}>
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  !selectedWalletId ? "bg-amber-500/10" : "bg-muted"
                )}>
                  <Wallet size={18} className={!selectedWalletId ? "text-amber-500" : "text-muted-foreground"} />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-xs font-medium",
                    !selectedWalletId ? "text-amber-500" : "text-muted-foreground"
                  )}>
                    Sumber Dompet
                  </span>
                  <span className={cn(
                    "text-sm",
                    !selectedWalletId ? "text-amber-600 font-medium" : "font-medium"
                  )}>
                    {selectedWalletName || "Pilih dompet sumber"}
                  </span>
                </div>
              </div>
            </WalletSelectDrawer>
          </div>
        )}

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

**Note:** The `cn` import is needed. Add it at the top:

```typescript
import { cn } from "@/lib/utils";
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/transactions/import/page.tsx
git commit -m "feat(import-mutation): add global wallet selector and category resolution save flow"
```

---

## Task 6: Verify End-to-End

- [ ] **Step 1: Run TypeScript check**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: Clean, no errors.

- [ ] **Step 2: Run build**

Run: `pnpm build 2>&1 | tail -20`
Expected: Build succeeds with `/transactions/import` in route list.

- [ ] **Step 3: Manual smoke test**

1. Open the app and tap "+" FAB
2. Tap "Impor Mutasi" → select a bank mutation screenshot
3. Verify AI returns transactions with `categoryKey`
4. Verify review page shows category names on each card
5. Verify "Lainnya" shows in amber for unmatched categories
6. Verify wallet selector at top shows amber warning until selected
7. Select a wallet → verify "Simpan Semua" button enables
8. Tap a card → verify edit drawer opens with pre-filled data
9. Save edit → verify card updates
10. Tap "Simpan Semua" → verify transactions saved and redirected

---

## Self-Review Checklist

- [x] **Spec coverage:** Single wallet (Task 5), AI category mapping (Task 3), category fallback "Lainnya" (Task 3 prompt), updated data types (Task 1), card shows category (Task 2), save flow with resolveCategory (Task 5), TransactionManager passes categories (Task 4)
- [x] **Placeholder scan:** No TBD/TODO. All code is complete.
- [x] **Type consistency:** `ParsedTransaction` has `categoryKey: string` in all files. AI returns `categoryKey`. Card reads `categoryKey`. Save flow resolves `categoryKey` → `categoryId` via `default:${key}` prefix.
