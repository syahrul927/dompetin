# Bulk Bank Mutation Import — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Overview

A feature that lets users import multiple transactions at once by scanning a bank or e-wallet mutation screenshot. The AI parses each row into a transaction object, the user reviews/edits them on a dedicated review screen, then saves all at once.

## User Flow

1. User taps "+" FAB → TransactionManager → InputMethodDrawer opens
2. User taps "Impor Mutasi" → camera/gallery picker opens
3. User selects a bank/e-wallet mutation screenshot
4. Image is compressed client-side (existing `compressImage` utility), sent to new tRPC mutation `scanBankMutation`
5. AI returns array of parsed transactions
6. App navigates to full-page review screen `/transactions/import`
7. User reviews list, taps items to edit via existing `AddTransactionSheet` drawer, can remove items
8. User taps "Simpan Semua" → `createBulkTransactions` mutation creates all transactions atomically
9. Redirect to transactions list with success toast

## Entry Point

New option "Impor Mutasi" added to `InputMethodDrawer` alongside existing options (Manual, Scan Struk, Suara, Teks Cerdas, Split Bill). Uses same camera/gallery picker pattern as existing Scan Struk.

## Backend

### AI Mutation: `scanBankMutation`

**File:** `src/server/api/routers/ai.ts`

- **Input:** `{ image: string, mimeType: string }`
- **Model:** `meta-llama/llama-4-scout-17b-16e-instruct` (same as existing)
- **Output:**
  ```typescript
  {
    transactions: Array<{
      name: string;
      amount: number;
      date: string;       // ISO date string
      type: "income" | "expense";
      notes: string;
    }>
  }
  ```
- **Prompt design:**
  - Instruct AI to identify each transaction row in a bank/e-wallet mutation screenshot
  - Parse: date, description/merchant name, amount, optional notes
  - Auto-detect type: credit entries (CR, incoming transfer, top-up) → `income`, debit entries (DB, outgoing transfer, payment) → `expense`
  - Handle Indonesian number formats (dots as thousand separators, comma as decimal)
  - Handle various date formats (DD/MM/YYYY, DD MMM YYYY, etc.)
  - Default to `expense` when type is ambiguous
  - Skip header rows, balance rows, non-transaction entries
- **Error cases:**
  - 0 transactions detected → return error "Tidak ada transaksi terdeteksi dari gambar"
  - Partial parse → return what was parsed, items with missing fields flagged

### Transaction Mutation: `createBulkTransactions`

**File:** `src/server/api/routers/transaction.ts`

- **Input:**
  ```typescript
  {
    transactions: Array<{
      type: "income" | "expense";
      amount: number;
      name: string;
      notes?: string;
      date: string;
      categoryId: string;
      walletId: string;
    }>;
    workspaceId: string;
  }
  ```
- **Behavior:**
  - Wraps all inserts in a single database transaction
  - Updates wallet balance atomically after all inserts
  - Only supports income and expense types (no transfers in bulk import)
  - Returns count of created transactions
- **Validation:**
  - All items must have required fields (walletId, categoryId, name, amount > 0)
  - All wallets and categories must belong to the workspace
  - Workspace membership check

## Frontend

### Review Screen: `/transactions/import`

**File:** `src/app/transactions/import/page.tsx`

**Layout:**
- Full-page within `AppShell` (back button in header, bottom nav hidden)
- `max-w-lg` constrained, mobile-first
- Header: back arrow + "Impor Mutasi" title + badge showing item count
- Scrollable card list of parsed transactions
- Sticky bottom bar with "Simpan Semua (N)" CTA button

**Transaction card design:**
- `Card` component with rounded corners
- Left color indicator: green for income, red for expense
- Shows: merchant name, formatted amount, date
- Status icon: checkmark when valid, warning when missing required fields (wallet/category)
- Tap → opens `AddTransactionSheet` drawer pre-filled with item data
- Delete: swipe-to-delete or small X button on card

**State management:**
- `ImportMutationProvider` context (follows `SplitBillProvider` pattern)
- Stores array of `ParsedTransaction` items in memory
- Each item tracks: AI-parsed data + user edits + validation status
- Editing an item via drawer updates the in-memory list (not saved to DB)
- Removing an item removes from the list
- "Simpan Semua" is disabled until all items are valid (have walletId and categoryId)

**Data types:**
```typescript
interface ParsedTransaction {
  id: string;           // client-side UUID for list keying
  name: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  notes: string;
  walletId?: string;    // user-assigned during review
  categoryId?: string;  // user-assigned during review
}
```

### Edit Flow

- Tapping a card opens `AddTransactionSheet` pre-filled with the item's data
- Step 1: amount + type (pre-filled from AI, editable)
- Step 2: name, category (required), wallet (required), date, notes
- On "Save" from drawer → item updates in the in-memory list
- Drawer closes, review screen reflects the change

### Color & Styling

Consistent with existing patterns:
- Income: `text-emerald-500` / `bg-emerald-500/10`
- Expense: `text-red-500` / `bg-red-500/10`
- Headers: `text-lg font-semibold`
- Body: `text-sm`
- Cards: `rounded-[20px]` with border
- Sticky CTA: `bg-primary text-white`

## Scope

- Supports Indonesian banks and e-wallets (BCA, BRI, Mandiri, BNI, GoPay, OVO, Dana, ShopeePay, etc.)
- Income and expense transactions only (no transfers)
- Single image import per session
- No undo after bulk save (relies on existing soft-delete for individual corrections)

## Out of Scope

- Multi-image import
- Transfer transaction detection
- Automatic category mapping by AI (user must assign categories during review)
- Automatic wallet detection by AI
- PDF/statement file import
