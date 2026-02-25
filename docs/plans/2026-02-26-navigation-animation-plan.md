# Navigation & Layout Animation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the navigation menu, dock the "+" FAB button next to it globally, and add smooth Framer Motion page transitions.

**Architecture:** We will move the FAB and `AddTransactionSheet` up to `AppShell` so they are accessible from anywhere without unmounting. We will install `framer-motion` and wrap the `children` of `AppShell` in an `AnimatePresence` wrapper that animates route changes based on `usePathname`. We will update the `BottomNav` to replace "Tujuan" with "Transaksi".

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS v4, Framer Motion

---

### Task 1: Install Framer Motion & Configure BottomNav

**Files:**
- Modify: `package.json`
- Modify: `src/components/shared/BottomNav.tsx`

**Step 1: Install framer-motion**

Run: `pnpm add framer-motion`
Expected: Installs successfully

**Step 2: Update BottomNav items**

Modify `src/components/shared/BottomNav.tsx` to replace Goals with Transactions and update the order.

```tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Clock, Target, User, ArrowRightLeft } from "lucide-react";

// In NAV_ITEMS:
const NAV_ITEMS = [
  { label: "Beranda", icon: Home, route: "/dashboard" },
  { label: "Transaksi", icon: ArrowRightLeft, route: "/transactions" },
  { label: "Dompet", icon: Wallet, route: "/wallets" },
  { label: "Anggaran", icon: Clock, route: "/budget" },
  { label: "Profil", icon: User, route: "/profile" },
] as const;
```

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/shared/BottomNav.tsx
git commit -m "feat(nav): update bottom nav items and install framer-motion"
```

### Task 2: Refactor FAB & AddTransactionSheet to AppShell

**Files:**
- Modify: `src/components/shared/AppShell.tsx`
- Modify: `src/components/shared/FAB.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/transactions/page.tsx`
- Modify: `src/app/wallets/page.tsx`

**Step 1: Update FAB styling for docked placement**

Modify `FAB.tsx` to remove fixed positioning so it can be controlled by a parent flex container.

```tsx
export function FAB({ onClick }: FABProps) {
  return (
    <Button
      onClick={onClick}
      className="h-14 w-14 rounded-full bg-primary shadow-[0_4px_16px_rgba(201,120,128,0.4)] transition-transform duration-150 hover:bg-primary active:scale-[0.93] flex-shrink-0"
    >
      <Plus size={24} className="stroke-[2.5] text-white" />
    </Button>
  );
}
```

**Step 2: Modify AppShell to include FAB and Sheet**

Update `AppShell.tsx` to become a Client Component that manages the transaction sheet state, and renders the BottomNav and FAB together in a docked container.

```tsx
"use client";

import React, { useState } from "react";
import { BottomNav } from "./BottomNav";
import { FAB } from "./FAB";
import { AddTransactionSheet } from "../transaction/AddTransactionSheet";
import { usePathname } from "next/navigation";

const HIDDEN_ROUTES = ["/login", "/register", "/onboarding"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const pathname = usePathname();

  const isHidden = HIDDEN_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div className="bg-background min-h-screen">
      <div className="relative mx-auto min-h-screen max-w-lg">
        {/* We keep the inner div scrollable */}
        <div className="scrollbar-hide overflow-y-auto">{children}</div>

        {!isHidden && (
          <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3">
            <BottomNav />
            <FAB onClick={() => setIsAddOpen(true)} />
          </div>
        )}
      </div>

      <AddTransactionSheet open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  );
}
```

**Step 3: Remove Fixed positioning from BottomNav**

Modify `BottomNav.tsx` to remove its internal fixed positioning wrapper, returning just the pill container, so AppShell can control its placement alongside the FAB.

```tsx
// Inside BottomNav return:
  return (
    <nav className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-3 shadow-[0_4px_24px_rgba(28,26,24,0.08)]">
      {/* existing map logic */}
    </nav>
  );
```
*(Remove the `HIDDEN_ROUTES` logic from BottomNav since AppShell now handles it).*

**Step 4: Remove individual FABs from pages**

Remove `FAB` and `AddTransactionSheet` from `dashboard/page.tsx`, `transactions/page.tsx`. Ensure their respective local `isAddOpen` state variables are removed.

**Step 5: Commit**

```bash
git add src/components/shared/AppShell.tsx src/components/shared/BottomNav.tsx src/components/shared/FAB.tsx src/app/dashboard/page.tsx src/app/transactions/page.tsx src/app/wallets/page.tsx
git commit -m "refactor(layout): dock FAB next to bottom nav and move transaction sheet to shell"
```

### Task 3: Implement Page Transitions with Framer Motion

**Files:**
- Create: `src/components/shared/AppTransition.tsx`
- Modify: `src/components/shared/AppShell.tsx`

**Step 1: Create the AppTransition component**

Create `src/components/shared/AppTransition.tsx`:

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export function AppTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Step 2: Wrap children in AppShell**

Modify `src/components/shared/AppShell.tsx` to wrap `children` with `AppTransition`.

```tsx
import { AppTransition } from "./AppTransition";

// Inside return:
        <div className="scrollbar-hide overflow-y-auto">
          <AppTransition>{children}</AppTransition>
        </div>
```

**Step 3: Remove native animations**

Remove the native CSS `animate-in fade-in slide-in-from-bottom-2` classes from the main divs inside `dashboard/page.tsx`, `transactions/page.tsx`, and `wallets/page.tsx` since Framer Motion now handles it globally.

**Step 4: Commit**

```bash
git add src/components/shared/AppTransition.tsx src/components/shared/AppShell.tsx src/app/dashboard/page.tsx src/app/transactions/page.tsx src/app/wallets/page.tsx
git commit -m "feat(animation): add framer-motion page transitions"
```

### Task 4: Move Goals to Profile Page

**Files:**
- Modify: `src/app/profile/page.tsx`

**Step 1: Add Goals link to Profile**

Add a new link to the Goals (`/goals`) page inside the Profile page menu.

```tsx
import { Target } from "lucide-react";

// Add to the profile menu links alongside Categories
<Link
  href="/goals"
  className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
>
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Target size={20} />
    </div>
    <span className="font-medium text-foreground">Tujuan Finansial</span>
  </div>
  <ChevronRight size={18} className="text-muted-foreground" />
</Link>
```

**Step 2: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): add goals link to profile menu"
```
