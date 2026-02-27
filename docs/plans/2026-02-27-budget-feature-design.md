# Budget Feature Design

## Context
The user wants to implement the "Anggaran" (Budget) feature. The application allows users to set monthly spending limits for specific categories and track their progress against those limits.

## Requirements
1. **Category Mapping:** Each budget is strictly mapped 1:1 to a specific expense category. A category can only have one active budget at a time.
2. **Dynamic Calculation:** Instead of relying on a static `spent` column in the database (which can easily get out of sync when transactions are edited or deleted), the backend will calculate the exact amount spent "on-the-fly" by querying all transactions for that category within the current month.
3. **UI/UX:** The main view will be a list of budget cards with visual progress bars. The creation and editing flows will use Vaul drawers to maintain consistency with the rest of the application.

## Architecture

### 1. Backend tRPC Router (`src/server/api/routers/budget.ts`)
- **`getBudgets`**: Fetch all active budgets for the `workspaceId`. Use Drizzle relations to fetch the linked `category`. Execute a parallel or sub-query to calculate the `SUM(amount)` of all `expense` transactions matching the `categoryId` within the current month. Map the results to return `{ ...budget, category, spent }`.
- **`createBudget`**: Check if a budget already exists for the given `categoryId`. If so, throw an error. Otherwise, insert the new budget (ignoring the `spent` column in schema entirely, defaulting to 0).
- **`updateBudget`**: Update the `amount` or `name` of an existing budget.
- **`deleteBudget`**: Soft delete or permanently delete the budget (since it only holds the limit, hard delete is usually safe, but standard is soft delete if `isActive` exists).

### 2. Frontend Components (`src/app/budget/`)
- **`BudgetPage`**: The main route. Fetches `getBudgets`. Renders a list of `BudgetCard` components. Contains the floating "Tambah Anggaran" button.
- **`BudgetCard`**: A component that takes a budget object. Displays the category icon/name, the limit, the spent amount, and a Shadcn `Progress` bar. Logic: if `spent > amount`, the progress bar turns red (`bg-destructive`).
- **`CreateBudgetDrawer`**: A drawer form containing:
  - Category Picker (reuse existing `CategorySelectDrawer` but filter out categories that already have budgets, or just validate on submit).
  - Amount Input (Numpad or standard text input formatted as currency).
- **`EditBudgetDrawer`**: A drawer to modify the budget limit or delete the budget entirely.

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.