# PWA Install Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a sleek, globally visible PWA install prompt at the top of the screen to encourage users to install the app.

**Architecture:** We will restyle the existing `InstallPrompt` component to float at the top of the screen (to avoid the bottom navigation) and integrate it globally into `src/app/layout.tsx`.

**Tech Stack:** Next.js 15, React, Tailwind CSS v4, PWA

---

### Task 1: Restyle the InstallPrompt Component

**Files:**
- Modify: `src/components/pwa/install-prompt.tsx`

**Step 1: Update positioning and styling**

Modify the main return statement of `InstallPrompt` to place it at the top of the screen with a width constraint matching the `AppShell`.

Change the wrapper div from `fixed bottom-4 right-4` to a centered top banner with nice styling:

```tsx
  return (
    <div className="fixed left-1/2 top-4 z-[60] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 animate-in slide-in-from-top-4 duration-300">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Install Dompetin
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {getInstallInstructions(platform)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isInstalling ? "..." : "Install"}
            </button>
            <button
              onClick={handleDismiss}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
```

**Step 2: Typecheck & Lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/pwa/install-prompt.tsx
git commit -m "style(pwa): update install prompt styling to floating top banner"
```

### Task 2: Integrate Globally in Layout

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Add InstallPrompt to RootLayout**

Import the `InstallPrompt` component and place it inside the `WorkspaceProvider` alongside `AppShell` and `OfflineIndicator`.

```tsx
import { InstallPrompt } from "@/components/pwa/install-prompt";

// Inside the body:
      <body>
        <TRPCReactProvider>
          <WorkspaceProvider>
            <AppShell>
              {children}
              <InstallPrompt />
              <OfflineIndicator />
            </AppShell>
          </WorkspaceProvider>
        </TRPCReactProvider>
      </body>
```

**Step 2: Typecheck & Lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(pwa): integrate install prompt globally in layout"
```