# Wallet Balance Synchronization Design

## Context
When transactions were created prior to a recent fix, the `wallet.balance` field in the database was not updated. As a result, users' dashboards show inaccurate total balances because the `wallet.balance` values do not reflect historical income, expenses, and transfers.

## Problem
The `wallet.balance` field must be permanently repaired in the database to reflect the true sum of all transactions. The user requested this repair to happen automatically via "Background Sync" without requiring manual intervention (like an admin button).

## Solution: Background Sync on Dashboard Load

1. **Lightweight Check in `getDashboardSummary`:**
   - When the dashboard loads and fetches the summary, compute two values for the workspace:
     a) `stored_total`: The sum of all `wallet.balance` fields.
     b) `computed_total`: The true sum of all transactions (income - expense).
   - *Note: Since wallets start with an initial balance (stored in `wallet.balance` at creation) and we don't have a separate `initial_balance` field, the `computed_total` must be derived from `initial_balance` + transaction sums. Since initial balances are currently in `wallet.balance`, the true balance for each wallet is its original `wallet.balance` plus the sum of transaction impacts.*

2. **Triggering the Repair:**
   - If the lightweight check detects a discrepancy (which it will for all users with legacy transactions), the server will asynchronously trigger a recalculation function.
   - To avoid blocking the `getDashboardSummary` response, the recalculation will either be dispatched via an asynchronous non-blocking call (e.g., `void recalculateWorkspaceBalances()`) or triggered via a separate client-side tRPC call if the summary returns a `needsSync: true` flag.

3. **Recalculation Logic:**
   - Iterate through each wallet in the workspace.
   - For each wallet, sum its related transactions (income, expense, transfers).
   - Update the `wallet.balance` field in the database with the corrected value.

## Implementation Steps

1. **Create `syncBalances` tRPC Mutation:**
   - Input: `workspaceId`.
   - Action: Computes and updates the true balance for all wallets in the workspace.

2. **Modify `getDashboardSummary`:**
   - Add logic to quickly compare stored vs. computed balances (or simply return a `needsSync` flag if a mismatch is likely).
   - *Alternatively, a simpler, more robust approach:* The dashboard client calls the `syncBalances` mutation silently in the background (`useMutation` in a `useEffect`) when it loads, ensuring balances are always eventually consistent.

3. **Database Updates:**
   - Ensure the balance update uses an atomic database transaction.
