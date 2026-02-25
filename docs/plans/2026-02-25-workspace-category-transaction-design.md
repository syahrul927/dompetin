# Workspace, Category, and Transaction Implementation Design

## 1. Workspace Context & Active State
**Problem**: The application needs to remember which workspace the user is currently viewing/managing, and this state needs to be accessible globally by Client Components to pass as `workspaceId` to tRPC queries.

**Approach**:
- Create a React Context (`WorkspaceContext`) that wraps the application.
- Use `localStorage` as the source of truth to persist the selection across reloads.
- Expose a `useActiveWorkspace()` custom hook that returns the current `workspaceId` and a `setWorkspaceId` function.
- **Migration**: Update `src/app/workspace/page.tsx` to read from the tRPC `workspace.getWorkspaces` query and use `useActiveWorkspace()` to mark the active workspace with a checkmark. When clicking a workspace, it updates the context and redirects to the Dashboard.

## 2. Category Master Management
**Problem**: Users need to be able to create, edit, and delete custom income/expense categories for their workspace.

**Approach**:
- **Location**: Add a new entry in the Profile/Settings page pointing to `/profile/categories`.
- **UI Components**:
  - `CategoryList`: Displays system categories (read-only) and custom categories (editable).
  - `CategoryIconPicker`: A copy of the new `WalletIconPicker` adapted for categories. It uses a nested Vaul Drawer containing a grid of Lucide icons logically grouped for categories.
  - `CreateCategoryDrawer` & `EditCategoryDrawer`: Vaul Drawer forms using `react-hook-form` + Zod to submit to the `category` tRPC router.

## 3. Transaction Flow & Custom Numpad
**Problem**: The `AddTransactionSheet` is currently a static mockup. Mobile users need a fast, one-handed way to enter transaction amounts, and the form needs to handle Income, Expense, and Transfer modes securely.

**Approach**:
- **Form Management**: Use `react-hook-form` with Zod validation. The form schema dynamically adjusts based on the selected type (e.g. `transfer` mode requires `toWalletId` instead of `categoryId`).
- **Amount Input**: Build a custom `NumpadDrawer` or integrate a custom numpad directly into the `AmountInput` component within the Add Transaction Drawer. This avoids the clunky native OS keyboard for fast numeric entry.
- **Form Rows**: Connect the existing `FormRow` components to nested Vaul Drawers for selecting Wallets and Categories.
- **Full List Page**: Create `/transactions/page.tsx` accessible via a "See All" button on the Dashboard. This page will use `transaction.getTransactions` with `limit` and `offset` for infinite scrolling or pagination.

## 4. Sequence of Implementation
1. `WorkspaceContext` + wire up `/workspace` page.
2. Category Management UI (`/profile/categories`) + `CategoryIconPicker`.
3. `CustomNumpad` component + connect `AddTransactionSheet` to tRPC via `react-hook-form`.
4. Dedicated `/transactions` page.