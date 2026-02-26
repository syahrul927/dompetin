# Feedback Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the transaction date input to be native and fully visible, implement real API data for workspace members, and remove glitchy page transitions.

**Architecture:**
1. `AddTransactionSheet.tsx`: Replace date FormRow with native `<input type="date">`.
2. `workspace.ts`: Add `getWorkspaceMembers` query.
3. `workspace/page.tsx`: Fetch and map members, remove mock data.
4. `AppShell.tsx`: Remove `framer-motion` page transition wrapper.

**Tech Stack:** Next.js 15, React, tRPC, Drizzle ORM

---

### Task 1: Fix Transaction Date Input

**Files:**
- Modify: `src/components/transaction/AddTransactionSheet.tsx`

**Step 1: Replace Date FormRow**

Update the date input section in `AddTransactionSheet.tsx` to use a visible HTML5 date input instead of the `FormRow` and hidden input. You can remove `useRef` and `dateRef`.

```tsx
                {/* Date */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground pl-1">Tanggal</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex h-12 w-full items-center justify-between rounded-2xl bg-muted/50 px-4 text-sm font-medium border border-border"
                  />
                </div>
```
*(Also remember to remove the unused `formatDate` helper function and `dateRef` definition at the top of the component)*

**Step 2: Commit**

```bash
git add src/components/transaction/AddTransactionSheet.tsx
git commit -m "fix(transaction): use native visible date input for mobile compatibility"
```

### Task 2: Implement Workspace Members API

**Files:**
- Modify: `src/server/api/routers/workspace.ts`
- Modify: `src/app/workspace/page.tsx`

**Step 1: Add `getWorkspaceMembers` procedure**

In `src/server/api/routers/workspace.ts`, add the query:

```typescript
  /**
   * Get all members for a specific workspace
   */
  getWorkspaceMembers: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Check if current user has access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) throw new Error("Access denied");

      // Fetch all members with their user details
      const members = await db.query.workspaceMember.findMany({
        where: eq(workspaceMember.workspaceId, input.workspaceId),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            }
          }
        },
        orderBy: [desc(workspaceMember.role), asc(workspaceMember.joinedAt)]
      });

      return members;
    }),
```

**Step 2: Update Workspace Page**

In `src/app/workspace/page.tsx`:
1. Remove `MOCK_MEMBERS`.
2. Add the tRPC query `api.workspace.getWorkspaceMembers.useQuery`.
3. Transform the data to match `MemberList` props.

```tsx
  // ... existing code ...
  const { workspaceId, setWorkspaceId } = useActiveWorkspace();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);

  // Fetch workspaces
  const { data: workspaces, isLoading: isLoadingWorkspaces } =
    api.workspace.getWorkspaces.useQuery({});

  // Fetch members
  const { data: membersData, isLoading: isLoadingMembers } =
    api.workspace.getWorkspaceMembers.useQuery(
      { workspaceId },
      { enabled: !!workspaceId }
    );
  // ... existing useEffect ...

  const mappedMembers = membersData?.map((m) => {
    const initials = m.user.name.split(" ").map((n) => n[0]).join("").toUpperCase() || "??";
    return {
      id: m.userId,
      name: m.user.name,
      email: m.user.email,
      initials,
      role: m.role as "owner" | "admin" | "member" | "viewer",
    };
  }) ?? [];

  // ... inside return ...
            <SectionHeader
              title={`Anggota — ${activeWorkspace.name}`}
              action={
                isOwner
                  ? {
                      label: "Undang",
                      onClick: () => setShowInviteDrawer(true),
                    }
                  : undefined
              }
            />
            {isLoadingMembers ? (
               <div className="space-y-3 px-1"><Skeleton className="h-14 w-full rounded-2xl" /></div>
            ) : (
               <MemberList members={mappedMembers} isOwner={isOwner} />
            )}
```

**Step 3: Typecheck & Commit**

Run: `pnpm typecheck`
Expected: PASS

```bash
git add src/server/api/routers/workspace.ts src/app/workspace/page.tsx
git commit -m "feat(workspace): fetch and display real workspace members"
```

### Task 3: Remove Screen Animations

**Files:**
- Modify: `src/components/shared/AppShell.tsx`

**Step 1: Remove Framer Motion wrapper**

Edit `src/components/shared/AppShell.tsx`:
1. Remove `import { motion, AnimatePresence } from "framer-motion";`
2. Remove `<AnimatePresence>` and `<motion.div>` completely.
3. Just render `{children}` directly inside the scrollable container.

```tsx
"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { FAB } from "./FAB";
import { AddTransactionSheet } from "../transaction/AddTransactionSheet";

const HIDDEN_ROUTES = ["/login", "/register", "/onboarding"];
const TOP_LEVEL_ROUTES = [
  "/dashboard",
  "/transactions",
  "/wallets",
  "/budget",
  "/profile",
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const pathname = usePathname();

  const isExplicitlyHidden = HIDDEN_ROUTES.some((route) => pathname.startsWith(route));
  const isTopLevel = TOP_LEVEL_ROUTES.includes(pathname);
  const isHidden = isExplicitlyHidden || !isTopLevel;

  return (
    <div className="bg-background min-h-screen">
      <div className="relative mx-auto min-h-screen max-w-lg">
        {/* Scrollable content */}
        <div className={`scrollbar-hide overflow-y-auto ${isHidden ? "" : "pb-28"}`}>
          {children}
        </div>

        {!isHidden && (
          <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2">
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

**Step 2: Commit**

```bash
git add src/components/shared/AppShell.tsx
git commit -m "style(ui): remove page transition animations to reduce visual glitching"
```