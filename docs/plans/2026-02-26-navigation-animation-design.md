# Navigation & Layout Animation Design

## Context
The user wants to enhance the main application layout by refactoring the navigation structure, consolidating the floating action button (FAB), and introducing smooth page transitions using Framer Motion.

## Goals
1. Reorganize Bottom Navigation items:
   - Remove "Tujuan" (Goals) from bottom nav (will move to Profile page).
   - Add "Transaksi" (Transactions) to bottom nav.
   - New order: Beranda, Transaksi, Dompet, Anggaran, Profil.
2. Visual alignment of FAB:
   - Move the "+" add transaction FAB so it visually aligns/docks next to the right side of the BottomNav pill, rather than floating far away on the right edge.
3. Smooth Page Transitions:
   - Use `framer-motion` to create a smooth fade/slide transition between top-level routes without destroying the layout or BottomNav.

## Architecture

### 1. Navigation Restructuring
- Update `NAV_ITEMS` in `src/components/shared/BottomNav.tsx` to match the new order and include `/transactions`.
- Update `src/app/profile/page.tsx` to include a link to the Goals page (`/goals`).

### 2. Docked FAB & Layout
Currently, `FAB` is injected inside every individual page, and `BottomNav` is inside `AppShell`. This makes transition orchestration difficult because `FAB` unmounts on page changes.
- **Change:** Extract the `FAB` from individual pages (Dashboard, Wallets, Transactions).
- **Change:** Render `BottomNav` and `FAB` together inside a global layout component or update `AppShell` to render them both as a docked group.
- **UI:** The BottomNav pill will sit in the center, and the FAB will sit immediately to its right, visually separate but aligned horizontally on the same plane.
- The FAB needs to trigger the `AddTransactionSheet`. To do this globally without prop-drilling state, we can move the `AddTransactionSheet` state to the layout level or provide it via context.

### 3. Page Transitions (Framer Motion)
- **Dependency:** Install `framer-motion`.
- **Component:** Create an `AppTransition` wrapper component in `src/components/shared/AppTransition.tsx`.
- **Mechanism:** It will use `AnimatePresence` mapped to `usePathname()`.
- **Integration:** Wrap the `children` prop inside `AppShell` with this transition component. This ensures the app shell (nav + FAB) stays statically mounted while the content inside fades/slides.

## Step-by-step Flow

1. Install `framer-motion`.
2. Restructure `BottomNav.tsx`.
3. Create `GlobalTransactionStore` context OR move `AddTransactionSheet` to `AppShell` with local state to handle the global FAB.
4. Refactor `AppShell` to include the FAB docked next to the nav, and remove the individual FABs from pages.
5. Implement `AppTransition` using Framer Motion and wrap `children` inside `AppShell`.
