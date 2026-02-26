# UI Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the dark mode Balance Hero Card, fix list spacing on the Category page, and prevent unwanted iOS zoom-in on inputs.

**Architecture:** Use Tailwind dark mode classes for the card background, adjust Tailwind padding utilities for layout spacing, and update Next.js metadata for the viewport fix.

**Tech Stack:** Next.js 15, Tailwind CSS v4, React

---

### Task 1: Update Balance Hero Card Dark Mode Styling

**Files:**
- Modify: `src/components/dashboard/BalanceHeroCard.tsx`

**Step 1: Update the Card component's styling**

Add specific dark mode overrides (`dark:bg-primary/10`, `dark:bg-none`) to replace the gradient, and add a subtle CSS radial gradient dot pattern using inline styles or Tailwind classes that only appear in dark mode via an absolute overlay.

```tsx
import React from "react";
import { formatIDR } from "@/lib/formatIDR";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface BalanceHeroCardProps {
  totalBalance: number;
  activeWalletCount: number;
  isLoading?: boolean;
}

export function BalanceHeroCard({
  totalBalance,
  activeWalletCount,
  isLoading,
}: BalanceHeroCardProps) {
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-5 dark:bg-primary/10 dark:bg-none">
        <div className="absolute inset-0 hidden opacity-[0.03] dark:block" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)", backgroundSize: "16px 16px" }} />
        <div className="relative z-10">
          <p className="text-xs text-muted-foreground">Total Saldo</p>
          <Skeleton className="mt-1 h-9 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden rounded-[20px] border-primary/20 bg-gradient-to-br from-card to-[#FDF4F5] p-5 dark:bg-primary/10 dark:bg-none">
      <div className="absolute inset-0 hidden opacity-[0.03] dark:block" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)", backgroundSize: "16px 16px" }} />
      <div className="relative z-10">
        <p className="text-xs text-muted-foreground">Total Saldo</p>
        <h2 className="text-[32px] font-bold tracking-tight text-foreground">
          {formatIDR(totalBalance)}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {activeWalletCount} dompet aktif
        </p>
      </div>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/BalanceHeroCard.tsx
git commit -m "style(dashboard): update hero card background for dark mode with subtle pattern"
```

### Task 2: Fix Category Page Spacing

**Files:**
- Modify: `src/app/profile/categories/page.tsx`

**Step 1: Increase padding-bottom**

Find the main content `div` wrapping the categories list and change `pb-28` to `pb-36` so the last item clears the floating button.

```tsx
// Find this line:
      <div className="px-5 pt-2 pb-28">

// Change to:
      <div className="px-5 pt-2 pb-36">
```

**Step 2: Commit**

```bash
git add src/app/profile/categories/page.tsx
git commit -m "style(category): increase list bottom padding to clear floating button"
```

### Task 3: Prevent iOS Input Zoom

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update viewport configuration**

Add `userScalable: false` to the `viewport` object in `src/app/layout.tsx` to stop iOS Safari from zooming in when focusing on input fields.

```tsx
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
```

**Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(ui): disable viewport user scaling to prevent iOS input zoom"
```