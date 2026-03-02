# Umami Analytics Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate self-hosted Umami Analytics into the Dompetin frontend to anonymously track page views and specific high-value user actions (like AI receipt scanning and core feature usage).

**Architecture:** Add the Umami tracking script to the root layout using Next.js `next/script` component, configured via environment variables. Create a generic custom React hook (`useAnalytics`) that safely exposes the `window.umami.track` function to client components. Integrate this hook into the AddTransaction, Goal, and Wallet modals, as well as the AI "Scan Struk" components.

**Tech Stack:** Next.js (App Router), React, TypeScript

---

### Task 1: Environment Variables Setup

**Files:**
- Modify: `src/env.js`
- Modify: `.env.example`

**Step 1: Write the failing test**
(No formal test for env setup, we will verify by checking type errors and Next.js build)

**Step 2: Write minimal implementation**

Update `src/env.js` to add the required client-side environment variables for Umami:

```typescript
// Add to server/client schemas in src/env.js
export const env = createEnv({
  // ... existing config
  client: {
    // ... existing client envs
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().uuid().optional(),
    NEXT_PUBLIC_UMAMI_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    // ... existing
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    NEXT_PUBLIC_UMAMI_URL: process.env.NEXT_PUBLIC_UMAMI_URL,
  },
});
```

Update `.env.example` to document these variables:

```bash
# Umami Analytics (Optional)
NEXT_PUBLIC_UMAMI_WEBSITE_ID="your-uuid-here"
NEXT_PUBLIC_UMAMI_URL="https://your-umami-instance.com"
```

**Step 3: Run test to verify it passes**

Run: `pnpm check`
Expected: PASS (No ESLint warnings or errors, TS compiles successfully)

**Step 4: Commit**

```bash
git add src/env.js .env.example
git commit -m "chore: add umami analytics environment variables"
```

---

### Task 2: Add Analytics Script to Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Write the failing test**
(No explicit test, we will verify the script tag is present in the DOM during manual/build check)

**Step 2: Write minimal implementation**

Add the `next/script` tag to `src/app/layout.tsx` to load the Umami script globally. It should only load if the environment variables are present.

```tsx
// Inside src/app/layout.tsx
import Script from "next/script";
import { env } from "@/env";

// Inside the <body> tag, preferably near the end
{env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && env.NEXT_PUBLIC_UMAMI_URL && (
  <Script
    defer
    src={`${env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
    data-website-id={env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
    strategy="afterInteractive"
  />
)}
```

**Step 3: Run test to verify it passes**

Run: `pnpm check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(analytics): add umami script to root layout"
```

---

### Task 3: Create `useAnalytics` Hook

**Files:**
- Create: `src/hooks/use-analytics.ts`
- Create: `src/types/global.d.ts` (if it doesn't exist, to add `window.umami` type)

**Step 1: Write the failing test**
(No formal test, we will verify TypeScript compilation)

**Step 2: Write minimal implementation**

First, ensure TypeScript knows about `window.umami` (create or update `src/types/global.d.ts`):

```typescript
// src/types/global.d.ts
interface Window {
  umami?: {
    track: (eventName: string, eventData?: Record<string, string | number>) => void;
  };
}
```

Then, create the hook `src/hooks/use-analytics.ts`:

```typescript
"use client";

import { useCallback } from "react";

export function useAnalytics() {
  const trackEvent = useCallback((eventName: string, eventData?: Record<string, string | number>) => {
    if (typeof window !== "undefined" && window.umami) {
      window.umami.track(eventName, eventData);
    }
  }, []);

  return { trackEvent };
}
```

**Step 3: Run test to verify it passes**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/hooks/use-analytics.ts src/types/global.d.ts
git commit -m "feat(analytics): create useAnalytics custom hook"
```

---

### Task 4: Integrate Analytics in Core Forms

**Files:**
- Modify: `src/components/transaction/AddTransactionSheet.tsx`
- Modify: `src/components/dashboard/GoalModal.tsx` (or wherever goals are created)
- Modify: `src/components/dashboard/WalletModal.tsx` (or wherever wallets are created)

**Step 1: Write the failing test**
(No formal test, verify by checking build and linting)

**Step 2: Write minimal implementation**

In `src/components/transaction/AddTransactionSheet.tsx`:
```tsx
import { useAnalytics } from "@/hooks/use-analytics";

// Inside component
const { trackEvent } = useAnalytics();

// Inside onSubmit success handler
trackEvent("transaction_added", { type: input.type });
```

*(Note: The implementer subagent will need to locate the exact modal files for Goals and Wallets and apply the same pattern for `goal_created` and `wallet_added` events).*

**Step 3: Run test to verify it passes**

Run: `pnpm check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/transaction/AddTransactionSheet.tsx # plus goal/wallet files
git commit -m "feat(analytics): integrate event tracking in core feature modals"
```

---

### Task 5: Integrate Analytics in Scan Struk (AI Feature)

**Files:**
- Modify: The component responsible for initiating "Scan Struk" (likely near `src/components/transaction/...`)
- Modify: The component responsible for handling the successful result of "Scan Struk"

**Step 1: Write the failing test**
(No formal test, verify by checking build and linting)

**Step 2: Write minimal implementation**

Find the Scan Struk button handler and add:
```tsx
import { useAnalytics } from "@/hooks/use-analytics";
// Inside component
const { trackEvent } = useAnalytics();

// In the onClick or start handler
trackEvent("scan_struk_initiated");
```

Find the Scan Struk success callback/handler and add:
```tsx
// In the success callback/handler
trackEvent("scan_struk_success");
```

**Step 3: Run test to verify it passes**

Run: `pnpm check`
Expected: PASS

**Step 4: Commit**

```bash
git add <scan_struk_files>
git commit -m "feat(analytics): track ai scan struk events"
```
