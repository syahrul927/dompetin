# Bulk Import Enhancement — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Overview

Enhancement to the bulk mutation import feature. Three key changes: (1) single wallet selection shared across all transactions, (2) AI returns category mapping using default category keys, (3) simplified edit drawer without wallet selector.

## Changes from Existing Implementation

### 1. Single Wallet on Review Screen

- Add `WalletSelectDrawer` at the top of `/transactions/import` review page, above the transaction list
- All imported transactions share this wallet — user selects once
- Remove per-item `walletId` from `ParsedTransaction` — replaced by global `walletId` on the page
- "Simpan Semua" disabled until wallet is selected AND all items have categories

### 2. AI Returns Category Mapping

**Update `scanBankMutation` input:**
- Accept `availableCategories: Array<{ key: string, name: string, type: string }>` — the DEFAULT_CATEGORIES list
- AI returns `categoryKey` for each transaction, matching a key from the provided list

**AI output per transaction:**
```typescript
{
  name: string;
  amount: number;
  date: string;          // YYYY-MM-DD
  type: "income" | "expense";
  categoryKey: string;   // e.g. "makanan-minuman", "gaji", "lainnya-expense"
  notes: string;         // optional description
}
```

**Fallback logic:**
- If AI can't match a category → use `"lainnya-expense"` or `"lainnya-income"` based on `type`
- The AI prompt explicitly lists all available category keys and instructs to pick the closest match

### 3. Updated Data Types

```typescript
interface ParsedTransaction {
  id: string;
  name: string;
  amount: number;
  date: string;          // YYYY-MM-DD
  type: "income" | "expense";
  categoryKey: string;   // DEFAULT_CATEGORIES key
  notes: string;
}
```

- Remove `walletId` and `categoryId` from ParsedTransaction
- Global `walletId` stored as page-level state
- Category resolution happens at save time via `resolveCategory`

### 4. Review Screen Changes

**Top section (above list):**
- Wallet selector row: "Pilih Dompet" with FormRow pattern → opens WalletSelectDrawer
- Shows selected wallet name, or placeholder if not selected

**Transaction card changes:**
- Show category name (resolved from `categoryKey` via DEFAULT_CATEGORIES lookup)
- Show "Lainnya" badge if category is a fallback
- Remove wallet-related validation — only check: categoryKey exists, name, amount, date

**Validation:**
- All items valid = wallet selected + every item has categoryKey + name + amount + date
- Category is always present (AI always returns one, defaulting to lainnya)

### 5. Simplified Edit Flow

When tapping a card:
- Open `AddTransactionSheet` pre-filled with item data
- Wallet is NOT editable in the drawer (set globally)
- Or use a lighter custom drawer since the full 2-step AddTransactionSheet flow is heavier than needed
- Editable fields: amount, type, name, category, date, notes

### 6. Save Flow

1. Resolve all unique `categoryKey` values → real DB `categoryId` via existing `resolveCategory` mutation
   - For each key: if `isDefaultCategoryId(key)` → call `resolveCategory` → get real ID
   - Cache resolved IDs to avoid duplicate calls
2. Apply global `walletId` to all items
3. Call `createBulkTransactions` with resolved data

### 7. TransactionManager Changes

- Pass `DEFAULT_CATEGORIES` to `scanBankMutation` input
- Map AI response to `ParsedTransaction` with `categoryKey`
- Store in sessionStorage as before

## Scope

- Only modifies existing bulk import files
- No new files needed (changes to existing context, card, page, AI router, TransactionManager)
- No database schema changes
- No changes to non-import transaction flows

## Out of Scope

- Custom categories from the workspace (only DEFAULT_CATEGORIES are used for AI matching)
- Multi-wallet import
- Transfer transaction detection
