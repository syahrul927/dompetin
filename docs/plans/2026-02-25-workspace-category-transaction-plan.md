# Workspace, Category, and Transaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement global workspace selection state, category management CRUD, and the complete add-transaction form with custom numpad.

**Architecture:** Use a React Context + LocalStorage for global workspace state. Use `tRPC` to query categories and transactions based on the active workspace. Use `react-hook-form` and `zod` to handle complex form states for transactions and categories, paired with Vaul `Drawer` for mobile-friendly interactions.

**Tech Stack:** Next.js 15, React Context, Tailwind CSS, shadcn/ui, Vaul (Drawer), react-hook-form, Zod, tRPC, Lucide React

---

### Task 1: Create Workspace Context & Custom Hook

**Files:**
- Create: `src/components/providers/workspace-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Write the Context and Hook**
Create `src/components/providers/workspace-provider.tsx` with a `WorkspaceProvider` that:
- Reads `workspaceId` from `localStorage` on mount (with fallback to an empty string to avoid hydration mismatch).
- Provides `workspaceId` and `setWorkspaceId`.
- Provides a custom hook `useActiveWorkspace()`.

**Step 2: Add Provider to Layout**
Modify `src/app/layout.tsx` to wrap `{children}` inside the `<WorkspaceProvider>`.

**Step 3: Commit**
```bash
git add src/components/providers/workspace-provider.tsx src/app/layout.tsx
git commit -m "feat(workspace): add global workspace context provider and hook"
```

---

### Task 2: Implement Workspace Page Logic

**Files:**
- Modify: `src/app/workspace/page.tsx`
- Modify: `src/components/workspace/WorkspaceListItem.tsx`

**Step 1: Wire up the Workspace Page**
Modify `src/app/workspace/page.tsx` to:
- Use `useActiveWorkspace()` to get/set the active `workspaceId`.
- Replace `MOCK_WORKSPACES` with `api.workspace.getWorkspaces.useQuery()`.
- Add a `useEffect` that auto-selects the first workspace if `workspaceId` from Context is empty.
- When `WorkspaceListItem` is clicked, call `setWorkspaceId(id)` and `router.push("/dashboard")`.

**Step 2: Clean up types**
Ensure `WorkspaceListItem.tsx` takes the correct type that `getWorkspaces` returns (`id`, `name`, `icon`, `role`, `memberCount`, `walletCount`).

**Step 3: Commit**
```bash
git add src/app/workspace/page.tsx src/components/workspace/WorkspaceListItem.tsx
git commit -m "feat(workspace): wire workspace list to trpc and context"
```

---

### Task 3: Build CategoryIconPicker

**Files:**
- Create: `src/lib/category-icons.ts`
- Create: `src/components/categories/CategoryIconPicker.tsx`

**Step 1: Create Category Icon Map**
Create `src/lib/category-icons.ts` mimicking `wallet-icons.ts`. Export `CATEGORY_ICONS` with common expense/income icons (e.g., `UtensilsCrossed`, `Car`, `ShoppingBag`, `Gamepad2`, `Receipt`, `Heart`, `BookOpen`, `Banknote`, `Briefcase`, `TrendingUp`, `Gift`, `PiggyBank`).

**Step 2: Build CategoryIconPicker**
Create `src/components/categories/CategoryIconPicker.tsx`. This should mirror `WalletIconPicker`, accepting `value`, `onChange`, and displaying a nested `<Drawer nested>` grid of Lucide icons.

**Step 3: Commit**
```bash
git add src/lib/category-icons.ts src/components/categories/CategoryIconPicker.tsx
git commit -m "feat(categories): add category lucide icon mapping and picker component"
```

---

### Task 4: Create Category Form Drawers

**Files:**
- Create: `src/components/categories/CreateCategoryDrawer.tsx`
- Create: `src/components/categories/EditCategoryDrawer.tsx`

**Step 1: Build Create Category Form**
Create `src/components/categories/CreateCategoryDrawer.tsx` using a Vaul `<Drawer>`.
- Use `react-hook-form` + zod for: `name`, `type` ("income" | "expense"), `icon`, `color`.
- Connect to `api.category.createCategory.useMutation()`.
- Upon success, call `utils.category.getCategories.invalidate()` and close drawer.

**Step 2: Build Edit Category Form**
Create `src/components/categories/EditCategoryDrawer.tsx` matching the create form.
- Use `useEffect` to populate `reset(category)` when drawer opens.
- Connect to `api.category.updateCategory.useMutation()`.

**Step 3: Commit**
```bash
git add src/components/categories/CreateCategoryDrawer.tsx src/components/categories/EditCategoryDrawer.tsx
git commit -m "feat(categories): add drawer forms for creating and editing categories"
```

---

### Task 5: Build Category Management Page

**Files:**
- Create: `src/app/profile/categories/page.tsx`
- Create: `src/components/categories/CategoryListItem.tsx`

**Step 1: Create CategoryListItem**
Build `src/components/categories/CategoryListItem.tsx` to display an icon, category name, type badge, and an edit button/chevron.

**Step 2: Create Page Structure**
Build `src/app/profile/categories/page.tsx`:
- Fetch categories via `api.category.getCategories.useQuery({ workspaceId })`.
- Separate the list into Income and Expense using two tabs or sections.
- Display `CategoryListItem`s.
- Provide an "Add Category" button that opens `CreateCategoryDrawer`.

**Step 3: Commit**
```bash
git add src/app/profile/categories/page.tsx src/components/categories/CategoryListItem.tsx
git commit -m "feat(categories): create category master management page"
```

---

### Task 6: Custom Numpad Component

**Files:**
- Create: `src/components/shared/Numpad.tsx`

**Step 1: Build the Component**
Create `src/components/shared/Numpad.tsx`:
- Props: `value: string`, `onChange: (val: string) => void`.
- Grid layout: 3 columns. Buttons for `1-9`, `0`, `000`, and `⌫` (backspace).
- Format the string value internally so it doesn't exceed reasonable lengths.

**Step 2: Commit**
```bash
git add src/components/shared/Numpad.tsx
git commit -m "feat(transaction): build custom numpad for fast amount entry"
```

---

### Task 7: Build Nested Pickers for Transaction Form

**Files:**
- Create: `src/components/transaction/WalletSelectDrawer.tsx`
- Create: `src/components/transaction/CategorySelectDrawer.tsx`

**Step 1: Build Wallet Select Drawer**
Create `src/components/transaction/WalletSelectDrawer.tsx`.
- Accept `value: string`, `onChange: (id: string) => void`, `workspaceId: string`.
- Use `<Drawer nested>`. Inside, map `api.wallet.getWallets.useQuery` to tappable rows.

**Step 2: Build Category Select Drawer**
Create `src/components/transaction/CategorySelectDrawer.tsx`.
- Accept `value: string`, `type: 'income' | 'expense'`, `onChange: (id: string) => void`, `workspaceId: string`.
- Use `<Drawer nested>`. Map `api.category.getCategories.useQuery` to tappable rows.

**Step 3: Commit**
```bash
git add src/components/transaction/WalletSelectDrawer.tsx src/components/transaction/CategorySelectDrawer.tsx
git commit -m "feat(transaction): add nested drawer pickers for transaction form"
```

---

### Task 8: Refactor AddTransactionSheet to react-hook-form

**Files:**
- Modify: `src/components/transaction/AddTransactionSheet.tsx`

**Step 1: Define Form State**
Use `zod` to create a schema requiring: `type` ("income", "expense", "transfer"), `amount`, `date`, `notes`, `walletId`. If `transfer`, require `toWalletId`, else require `categoryId`.

**Step 2: Integrate UI Components**
- Render `Numpad` for `amount` field.
- Render `FormRow` components connected to `WalletSelectDrawer` and `CategorySelectDrawer`.
- Ensure switching types (Expense -> Transfer) clears irrelevant fields and triggers validation correctly.

**Step 3: Connect to API**
- On submit, call `api.transaction.createTransaction` or `api.transaction.createTransfer` depending on the type.
- Invalidate `transaction.getTransactions`, `wallet.getWallets`, `analytics.summary`.

**Step 4: Commit**
```bash
git add src/components/transaction/AddTransactionSheet.tsx
git commit -m "feat(transaction): refactor add transaction form to use trpc and numpad"
```

---

### Task 9: Transaction List Page

**Files:**
- Create: `src/app/transactions/page.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Build the Full List Page**
Create `src/app/transactions/page.tsx`.
- Include `<PageHeader variant="back" title="Semua Transaksi" />`.
- Fetch data using `api.transaction.getTransactions.useInfiniteQuery()`.
- Group transactions by date visually (e.g. headers for "Today", "Yesterday").
- Render `TransactionRow` components.

**Step 2: Connect Dashboard Button**
Modify `src/app/dashboard/page.tsx` to link the "Lihat Semua" button in the Recent Transactions section to `/transactions`.

**Step 3: Commit**
```bash
git add src/app/transactions/page.tsx src/app/dashboard/page.tsx
git commit -m "feat(transaction): build dedicated transactions list page"
```
