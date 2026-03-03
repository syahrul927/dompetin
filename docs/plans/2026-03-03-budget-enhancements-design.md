# Budget Enhancements Design

## 1. Overview
Enhance the existing budget feature to support scopes (daily, weekly, monthly, yearly) with fixed calendar boundaries, auto-renewal (lazy), and an archived vs. active view.

## 2. Database Changes
No schema migrations are strictly necessary, as `budget` already has `period`, `startDate`, `endDate`, and `isActive` fields.

*   `period`: Will strictly use "daily", "weekly", "monthly", "yearly".
*   `startDate` & `endDate`: Will map to fixed calendar boundaries (e.g., Monthly: 1st - end of month).
*   `isActive`: Used to differentiate between active and archived budgets.

## 3. Backend Logic (tRPC `budgetRouter`)

### 3.1. Auto-Renewal Logic (Lazy)
When fetching active budgets (`getBudgets`), the backend will:
1.  Query all active budgets for the workspace.
2.  Iterate through them. If an active budget's `endDate` is strictly before `new Date()` (the current date):
    *   Mark the old budget as `isActive = false` (Archive it).
    *   Calculate the new `startDate` and `endDate` for the next period based on the budget's `period`.
    *   Create a *new* cloned budget record with the new dates and `isActive = true`.
3.  Return the updated list of active budgets.

### 3.2. Query Adjustments
*   `getBudgets` will calculate `spent` by filtering transactions strictly between the budget's specific `startDate` and `endDate`, rather than the generic "current month".
*   The `isActive` filter will allow fetching either the "Active" or "Archived" list.

### 3.3. Creation Logic
*   When creating a budget (`createBudget`), the backend will automatically compute `startDate` and `endDate` based on the chosen `period` and the current date.

## 4. Frontend UI Components

### 4.1. Budget Card (`BudgetCard.tsx`)
*   Add a visual indicator for the date range (e.g., "01 Jan 2024 - 31 Jan 2024").

### 4.2. Budget List Page (`page.tsx` or main view)
*   Introduce Tabs (shadcn/ui `Tabs` component) for "Active" and "Archived".
*   The "Active" tab fetches budgets where `isActive: true`.
*   The "Archived" tab fetches budgets where `isActive: false`.

### 4.3. Editing (`EditBudgetDrawer.tsx`)
*   Disable editing if the budget is archived (`isActive === false`).

### 4.4. Transaction Forms (`AddTransactionSheet.tsx`, etc.)
*   Ensure the budget selection dropdown only shows active budgets (which it likely already does if it filters by `isActive: true`).

## 5. Security & Error Handling
*   Ensure the auto-renewal logic handles edge cases (like a user logging in after skipping several months—it should either create the current month's budget immediately or create the intermediate ones if strictly necessary. For simplicity, just create the *current* active period).

## 6. Testing Strategy
*   Verify period boundary calculations (especially leap years/end of month).
*   Verify that viewing the page automatically archives expired budgets and creates new ones.
*   Verify archived budgets cannot be edited.
