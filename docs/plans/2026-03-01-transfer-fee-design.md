# Transfer Fee Feature Design

## Goal
Implement a transfer fee feature where users can optionally specify an administrative or bank fee when creating a transfer transaction. This fee will be recorded as a separate expense transaction but linked to the same transfer process. The transaction list UI will aggregate these related records into a single row to reduce clutter and improve user experience.

## Architecture

### 1. Database Schema (`dompetin-schema.ts`)
- Add an `isTransferFee: boolean` column to the `transaction` table, defaulting to `false`. This explicitly tags an expense as a transfer fee, making it easy to group and differentiate from regular expenses that happen to share a `transferId`.

### 2. Backend Logic (`transaction.ts` tRPC router)
- **`createTransfer` Procedure**:
  - Add an optional `feeAmount` (number) parameter to the input schema.
  - If `feeAmount` is provided and greater than 0:
    1. Find or create a system category named "Biaya Transfer".
    2. Insert a third transaction: `type: "expense"`, `amount: feeAmount`, `walletId: fromWalletId`, `transferId: transferId`, `categoryId: [Biaya Transfer ID]`, and `isTransferFee: true`.
    3. Deduct `feeAmount` from the `fromWalletId` balance (in addition to the transfer amount).
- **`getTransactions` Procedure**:
  - Fetch transactions as normal.
  - Post-process the result to group transactions sharing the same `transferId`.
  - Collapse the 2-3 database rows (Sender Debit, Receiver Credit, optional Fee Expense) into a single logical "Transfer" object for the frontend list, containing both the primary transfer `amount` and the `feeAmount`.
- **`updateTransaction` / `deleteTransaction`**:
  - Ensure modifying or deleting a transfer handles all linked records (Sender, Receiver, and Fee) correctly to maintain data consistency.

### 3. Frontend Components
- **Transfer Form Tab**:
  - Add a Shadcn Switch toggle labeled "Ada Biaya Transfer?".
  - When toggled ON, conditionally render a number input field for "Nominal Biaya Transfer".
  - Pass the fee value to the `createTransfer` mutation.
- **Transaction List Item**:
  - Render transfers as a single, unified row: `[Sender Wallet] → [Receiver Wallet]`.
  - Display the base transfer amount prominently.
  - If a `feeAmount` exists, append a muted sub-label (e.g., "(+ Biaya Rp X.XXX)") below the amount or wallet names.
  - Use an arrow or dual-wallet icon to symbolize the transfer event clearly.