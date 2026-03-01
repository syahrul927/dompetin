# Transaction Screen UX & Analytics Update

## Objective
Revamp the Transactions screen UX to default to a monthly view rather than pulling all historical data, minimizing initial database load. Move the Expense Pie Chart from the Dashboard to the Transactions page, and add new high-level insights (Monthly Summary and Cashflow Bar Chart).

## 1. UI & State Management (Transactions Page)
- **Filters**: Two `Select` components (shadcn/ui) placed below the `PageHeader`.
  - **Month**: January to December. Default: Current Month.
  - **Year**: e.g., 2020 to Current Year + 1. Default: Current Year.
- **State**: `month` (number 1-12) and `year` (number). These trigger refetching for all charts and the transaction list.
- **Transaction List Behavior**: Infinite scroll continues to work, but is bounded to the selected month and year.

## 2. API & Backend (tRPC `transaction.ts`)
- **Modify `getTransactions`**:
  - Add optional `month` (number 1-12) and `year` (number) inputs.
  - If provided, use `drizzle-orm` bounds (`gte` first day of month, `lte` last day of month) instead of fetching all history.
- **Create `getTransactionAnalytics`**:
  - Inputs: `workspaceId`, `month`, `year`.
  - Outputs:
    - **Summary**: `income` and `expense` totals for the selected month.
    - **Comparison**: `%` change vs the previous month.
    - **Cashflow**: Daily `income` and `expense` array for the Bar Chart.
  - *Note*: Ensure the time boundaries (start/end of month) are correctly calculated in JavaScript to prevent timezone drift before passing to the SQL query.
- **Modify `getExpenseByCategory`**:
  - It currently hardcodes `currentYear` and `currentMonth`. Update to accept optional `month` and `year` parameters to support the newly moved Pie Chart filtering.

## 3. UI Layout (Stacked Vertically)
1. **Filters Row**: `Month` and `Year` Select components.
2. **Summary Cards**: Show Total Income, Total Expense, and their percentage change compared to the previous month.
3. **Cashflow Bar Chart**: Display daily income vs expense across the month.
4. **Expense Category Pie Chart**: The component previously on the Dashboard, now rendering here and respecting the month/year filter.
5. **Transaction List**: Grouped by date, with infinite scrolling ("Muat Lebih Banyak").

## 4. Dashboard Cleanup
- Remove the `ExpenseCategoryChart` component from `src/app/dashboard/page.tsx`.
- Adjust dashboard layout to flow correctly without it.
