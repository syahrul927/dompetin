# Transaction Update and Delete Feature Design

**Date:** 2026-02-27

## Overview
A feature allowing users to edit or completely delete their own transactions to fix mistakes or remove incorrect entries. Additionally, the UI will be enhanced to display the name of the user who created the transaction, improving visibility in shared workspaces.

## Architecture & State Management

1. **State:**
   - A global `activeTransaction` state object (or ID) will be held at the page level (`transactions/page.tsx` and `dashboard/page.tsx` or similar list views).
   - `actionSheetOpen` state determines if the bottom action sheet is visible.
2. **Component - `TransactionActionSheet`:**
   - A new Vaul `Drawer` component that acts as an action sheet.
   - It receives the `activeTransaction` as a prop.
   - Contains two primary actions:
     - **Edit Transaksi:** Opens the `AddTransactionSheet` in "Edit Mode".
     - **Hapus Transaksi:** Displays a destructive, red button that triggers an `AlertDialog` for confirmation.
   - **Authorization:** These actions are ONLY visible/enabled if `session.user.id === activeTransaction.createdBy.id`.

## AddTransactionSheet (Edit Mode Adaptation)

The existing `AddTransactionSheet` will be refactored to support both creation and editing.
1. **New Props:** `initialData?: Partial<Transaction>` to pre-fill the form, and `editMode?: boolean`.
2. **Form Pre-fill:** On mount/open, if `initialData` is provided, state variables (`amount`, `name`, `categoryId`, `walletId`, `date`, `note`) will be populated.
3. **Restricted Fields:** The `TypeToggle` (Income/Expense/Transfer) will be **disabled** during edit mode. Allowing users to change a transaction from "Expense" to "Transfer" introduces complex cross-wallet balance correction edge cases that are better handled by deleting and recreating the transaction.
4. **Mutations:** If in edit mode, the submit button triggers `updateTransaction.mutateAsync` instead of `createTransaction`.

## TransactionRow Enhancement (Username Attribution)

The `TransactionRow` component will be updated to display the creator's name.
1. **API:** The `getTransactions` and `getDashboardSummary` tRPC routes already fetch `createdBy` (which includes `name` and `image`).
2. **Mapping:** The client-side data mapping in `page.tsx` will include `authorName: tx.createdBy?.name`.
3. **UI Display:** The subtitle of `TransactionRow` will be updated from `{category} · {date}` to `{authorName} · {category} · {date}` (e.g., "Budi · Makanan · 15 Feb").

## Deletion Flow & Balance Corrections

To ensure wallet balances remain perfectly synchronized with transaction history:
1. **Database Action:** Deletion will perform a **hard delete** (`db.delete()`), completely removing the transaction row from the database, rather than a soft delete.
2. **Balance Reversion:** A new or updated tRPC mutation (`deleteTransaction`) will run a database transaction that:
   - Fetches the transaction details.
   - Deletes the transaction.
   - Reverts the wallet balance(s) based on the transaction type (e.g., if an expense of 50,000 is deleted, 50,000 is added back to the wallet).
3. **Transfers:** For transfer transactions, deleting the transaction will revert both the source wallet (adding the amount back) and the destination wallet (subtracting the amount).
4. **Invalidation:** After successful deletion, `transaction.getTransactions` and `wallet.getWallets` queries will be invalidated to refresh the UI.