# Design Doc: Transfer Wallet Update Refinement

## Context
Currently, the `updateTransaction` procedure in `transaction.ts` allows updating amounts, metadata, and fees for transfers. However, it lacks the ability to change the source (`walletId`) or destination (`toWalletId`) wallets of an existing transfer.

## Requirements
- Allow users to change `walletId` (source) or `toWalletId` (destination) for existing transfers.
- Atomically update balances for all affected wallets:
    - Revert balances for the old source and destination wallets.
    - Apply new balances to the new source and destination wallets.
- Maintain linkage between all legs (debit, credit, fee).
- Handle edge cases where only one wallet is changed.
- Sync metadata (name, date, notes) across the new group.

## Proposed Logic (Approach 1: Integrated updateTransaction)

### 1. Identify Transfer Group
When a `walletId` or `toWalletId` update is requested for a transaction with `type: "transfer"`:
- Fetch all existing legs of the transfer using `transferId` (debit, credit, and optional fee).

### 2. Balance Reversion (Atomically)
Inside a DB transaction:
- For each old leg:
    - If it's the debit leg (negative amount): Add amount back to its wallet.
    - If it's the credit leg (positive amount): Subtract amount from its wallet.
    - If it's the fee leg (negative amount): Add amount back to its wallet.

### 3. Apply New Wallets and Balances
- Update the `walletId` and `toWalletId` fields on the main legs.
- Update the `walletId` on the fee leg (it always follows the source/debit wallet).
- Recalculate and apply new balances:
    - New source wallet: Subtract (amount + fee).
    - New destination wallet: Add amount.

### 4. Metadata Sync
- Ensure `name`, `date`, and `notes` are propagated to all legs in the new configuration.

## Schema Changes
No schema changes required.

## Test Plan
- Create a transfer from Wallet A to Wallet B.
- Update `walletId` to Wallet C.
- Verify:
    - Wallet A balance is reverted (+amount).
    - Wallet C balance is updated (-amount).
    - Wallet B balance remains unchanged (since it was the destination and we only changed source).
- Create a transfer with a fee.
- Update `toWalletId`.
- Verify fee remains linked to the source wallet.
- Verify all legs are updated correctly.
