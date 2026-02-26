# Category Management Refactor Design

## Context
The user encountered usability issues with the category management UI. Specifically, when opening the "Tambah Kategori" (Create Category) drawer and then clicking to select an icon, a second *nested* drawer appears. Vaul (the drawer library) struggles with deeply nested scrollable drawers, leading to scrolling issues inside the icon picker.

To solve this and improve maintainability, we will replace the parent drawers with dedicated pages.

## Architecture

### 1. New Category Creation Page
- **Route:** `src/app/profile/categories/create/page.tsx`
- **UI:** A standard Next.js page featuring a `PageHeader` with a back button ("Kategori Baru").
- **Content:** The exact same form from `CreateCategoryDrawer` (Name, Icon, Color, Submit).
- **Benefit:** Since this is now a page, the `CategoryIconPicker` will open as a primary, first-level drawer, completely eliminating the nesting issues.

### 2. New Category Edit Page
- **Route:** `src/app/profile/categories/[id]/edit/page.tsx`
- **UI:** A standard Next.js page featuring a `PageHeader` with a back button ("Edit Kategori") and a separate "Delete" button in the header or at the bottom.
- **Content:** The exact same form from `EditCategoryDrawer`.
- **Data Loading:** The page will read the `id` from the URL params and fetch the category details via a new or existing tRPC query (`api.category.getCategory`).

### 3. Cleanup Existing UI
- **Remove:** `src/components/categories/CreateCategoryDrawer.tsx`
- **Remove:** `src/components/categories/EditCategoryDrawer.tsx`
- **Update:** `src/app/profile/categories/page.tsx`
  - Remove the local state for `showCreate` and `editingCategory`.
  - Update the "Tambah Kategori" FAB/button to use `<Link href="/profile/categories/create">`.
  - Update the category list items to use `<Link href="/profile/categories/${cat.id}/edit">` instead of setting local state.

### 4. Icon Picker Update
- **Modify:** `src/components/categories/CategoryIconPicker.tsx`
- **Change:** Remove the `nested` prop from the `<Drawer>` component, as it is no longer rendering inside another drawer.

## Backend Changes Needed
- **Router:** `src/server/api/routers/category.ts`
- **Procedure:** Add `getCategory(id)` if it doesn't exist so the edit page can fetch the specific category being edited.

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.