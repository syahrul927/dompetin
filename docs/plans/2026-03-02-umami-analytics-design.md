# Umami Analytics Integration Design

**Goal:** Implement fully anonymous, self-hosted web analytics (Umami) to track core product usage and high-value AI features (like "Scan Struk") without compromising user privacy.

**Architecture:**
- **Backend (External):** Umami self-hosted on a separate Vercel project with a dedicated PostgreSQL database (Supabase/Neon).
- **Frontend (Dompetin):** Next.js App Router integration using a custom React hook wrapping the Umami tracking script.

## 1. Privacy & Data Handling (Core Tenets)
- **100% Anonymous:** We will deliberately **NOT** pass the `userId`, `email`, or any PII (Personally Identifiable Information) to Umami.
- **Cookie-less:** Umami does not use cookies, meaning no annoying cookie consent banners are needed for GDPR compliance.
- **Event Naming:** We will only track generic actions like `"transaction_created"` or `"scan_struk_success"`. We will never pass sensitive financial data (like transaction amounts or categories) as event properties.

## 2. Implementation: The `useAnalytics` Hook

We will create a lightweight custom hook (`src/hooks/use-analytics.ts`) to wrap Umami's client-side tracking functions and ensure type safety.

```typescript
"use client";

export function useAnalytics() {
  const trackEvent = (eventName: string, eventData?: Record<string, string | number>) => {
    if (typeof window !== "undefined" && window.umami) {
      window.umami.track(eventName, eventData);
    }
  };

  return { trackEvent };
}
```

The Umami script itself will be loaded globally via `next/script` in `src/app/layout.tsx`. It will require two environment variables:
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
- `NEXT_PUBLIC_UMAMI_URL`

## 3. Integration Points (Event Tracking)

We will integrate this hook into key client components to track major app milestones, focusing heavily on selling points like AI receipt scanning.

### A. Selling Points (AI Features)
- **Scan Struk (Receipt Scanning):**
  - Event: `"scan_struk_initiated"` (When a user clicks the button to start the process)
  - Event: `"scan_struk_success"` (When the AI successfully parses a receipt)
- **Future AI Features:**
  - Event Pattern: `"ai_feature_used"` with properties `{ feature_name: "future_ai_bot" }`

### B. Core App Usage
- **Transactions:** Event `"transaction_added"` (with property `{ type: input.type }` to distinguish income/expense/transfer).
- **Budgets:** Event `"budget_created"`
- **Goals:** Event `"goal_created"`
- **Wallets:** Event `"wallet_added"`
