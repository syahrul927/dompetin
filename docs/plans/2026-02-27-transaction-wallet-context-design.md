# Transaction Wallet Context Design

**Date:** 2026-02-27

## Overview
Enhance the transaction list UI to display which wallet a transaction belongs to. For transfers, it will show both the origin and destination wallets. This helps users contextualize their transactions without having to open the details.

## API Changes
The tRPC router needs to ensure that the `wallet` and `toWallet` relations are always loaded when returning transactions.
- `transaction.getTransactions`: Already includes `wallet.name` and `toWallet.name`. No changes needed.
- `wallet.getWallet`: The `recentTransactions` query inside this route must be updated to eager-load `wallet` and `toWallet`.

## Frontend Data Mapping
Instead of putting business logic inside the UI component, the parent pages will format the data.
A new `walletContext` string property will be mapped for each transaction:

```typescript
// For Income / Expense
let walletContext = tx.wallet?.name || "Unknown";

// For Transfer
if (tx.type === "transfer") {
  walletContext = `${tx.wallet?.name} -> ${tx.toWallet?.name}`;
}
```

This mapping will be applied in:
- `src/app/transactions/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/wallets/[id]/page.tsx`

## UI Component Changes
Modify `src/components/shared/TransactionRow.tsx`:
1. Add `walletContext?: string` to `TransactionRowProps`.
2. Update the subtitle paragraph to render the wallet context seamlessly:

```tsx
<p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
  {transaction.authorName ? `${transaction.authorName} · ` : ""}
  {transaction.category}
  {transaction.walletContext ? ` · ${transaction.walletContext}` : ""}
  {` · ${transaction.date}`}
</p>
```
*(Added `line-clamp-1` to prevent the text from breaking into multiple lines and making the row too tall on smaller screens).*