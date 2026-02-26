# UI Enhancements Design

## Context
The user provided feedback on three distinct UI areas that need refinement:
1. **Balance Hero Card in Dark Mode:** The current gradient looks out of place. They want a flat primary color matching the palette, accented by a low-opacity pattern rather than a gradient.
2. **Category Page List Cutoff:** The absolute positioned "Tambah Kategori" button at the bottom of the screen overlaps and hides the last few items in the category list.
3. **Viewport Zooming:** When interacting with forms/inputs, iOS Safari auto-zooms into the page. The user wants to lock the scale to 1.

## Architecture & Implementation Strategy

### 1. Balance Hero Card (Dark Mode)
- **Component:** `src/components/dashboard/BalanceHeroCard.tsx`
- **Current State:** Uses `bg-gradient-to-br from-card to-[#FDF4F5]`.
- **New Design:** We will use Tailwind's `dark:` variant to override the background in dark mode. We'll set the base background to the primary color (`dark:bg-primary/20` or similar solid flat tone) and apply a CSS-based dot pattern using a custom class or inline style with `radial-gradient` that only appears in dark mode (or adjust the existing gradient to only apply in light mode).
- **Execution:**
  - Light mode: Keep existing gradient.
  - Dark mode: Flat `bg-primary/10` with a subtle absolute positioned dot pattern overlay.

### 2. Category Page Spacing
- **Component:** `src/app/profile/categories/page.tsx`
- **Current State:** The list container has `pb-28`.
- **New Design:** Increase the padding bottom significantly, likely to `pb-36` or `pb-40`, to ensure the last category item clears the large floating "Tambah Kategori" button which is pinned to the bottom.

### 3. Viewport Zoom Fix
- **File:** `src/app/layout.tsx`
- **Current State:** Uses `viewport = { width: "device-width", initialScale: 1, maximumScale: 1 }`.
- **New Design:** We will add `userScalable: false` to the `viewport` export object. This is the standard way in Next.js 15 App Router to prevent iOS Safari from zooming in when an input is focused.

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.