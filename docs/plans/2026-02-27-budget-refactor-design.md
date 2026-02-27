# Budget Refactor Design: Uncoupling Budgets from Categories

**Date:** 2026-02-27

## Context
The previous assumption was that Budgets strictly map 1:1 to Categories. The user clarified that Budgets should be completely independent of Categories. A user can create an expense transaction and optionally link it to a specific Budget (e.g., "Holiday Trip", "Monthly Groceries").

Additionally, there are UI tweaks requested:
1. Move the "+ Budget" button to the bottom of the list with a nice outline style instead of a FAB.
2. Prevent double-click submission bugs in the `AddTransactionSheet`.

## 1. Schema Changes
The database schema must be altered:
- **`budget` table:** Remove `categoryId` (or make it optional/null for migration safety, then drop). Add an `icon` and `color` column so budgets can still have a visual identity since they no longer inherit from a category.
- **`transaction` table:** Add a nullable `budgetId` column linking to the `budget` table.

## 2. API Changes
- **`transactionRouter.createTransaction` / `updateTransaction`**: Allow accepting and saving an optional `budgetId`. (Only valid for `type === "expense"`).
- **`budgetRouter.getBudgets`**: Update the dynamic calculation subquery. Instead of grouping by `transaction.categoryId === budget.categoryId`, it must calculate spending where `transaction.budgetId === budget.id`.
- **`budgetRouter.createBudget` / `updateBudget`**: Remove `categoryId` requirements. Allow setting `icon` and `color`.

## 3. UI Changes: AddTransactionSheet
- When `type === "expense"`, show a new field under Category: **"Pilih Anggaran (Opsional)"**.
- This will use a new `BudgetSelectDrawer` component (similar to `CategorySelectDrawer`) allowing the user to pick an active budget.
- Add `isSubmitting` disable logic strictly tied to the button state to prevent double submissions.

## 4. UI Changes: Budget Page & Drawers
- **`BudgetPage`**: Remove the FAB. Add an outline button "Tambah Anggaran Baru" at the bottom of the list.
- **`CreateBudgetDrawer` & `EditBudgetDrawer`**: Remove the category picker. Add UI to select an Icon and Color for the budget.
- **`BudgetCard`**: Display the budget's own icon and color instead of the category's.