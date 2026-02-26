# Workspace Invitation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a workspace invitation system where owners can invite registered users via email, and users can accept/reject invitations from their profile page.

**Architecture:**
1. Database: Add `dompetin_invitation` table to Drizzle schema.
2. Backend: Add `inviteMember`, `getPendingInvitations`, and `respondToInvitation` mutations/queries to `workspace.ts` tRPC router.
3. Frontend: Wire up `InviteMemberDrawer.tsx` to call the mutation. Add "Undangan Workspace" menu to `ProfilePage`. Create `/profile/invitations/page.tsx` to list and respond to invites.

**Tech Stack:** Next.js 15, tRPC, Drizzle ORM, PostgreSQL, Tailwind CSS v4

---

### Task 1: Database Schema for Invitations

**Files:**
- Modify: `src/server/db/dompetin-schema.ts`

**Step 1: Add invitation status enum and table**

Add the enum and table definition to the schema:

```typescript
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const invitation = pgTable("dompetin_invitation", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  workspaceId: uuidColumn("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: text("role")
    .$type<"admin" | "member" | "viewer">()
    .notNull()
    .default("member"),
  status: text("status")
    .$type<"pending" | "accepted" | "rejected">()
    .notNull()
    .default("pending"),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});
```

Also add it to relations:
```typescript
export const invitationRelations = relations(invitation, ({ one }) => ({
  workspace: one(workspace, {
    fields: [invitation.workspaceId],
    references: [workspace.id],
  }),
  inviter: one(user, {
    fields: [invitation.invitedBy],
    references: [user.id],
  }),
}));

// In workspaceRelations add:
  invitations: many(invitation),
```

**Step 2: Generate and push migrations**

Run: `pnpm db:generate && pnpm db:push`
Expected: Migrations applied successfully.

**Step 3: Commit**

```bash
git add src/server/db/dompetin-schema.ts drizzle/
git commit -m "feat(db): add workspace invitation schema"
```

### Task 2: Backend tRPC Procedures

**Files:**
- Modify: `src/server/api/routers/workspace.ts`

**Step 1: Add `inviteMember` mutation**

In `workspace.ts`, add the mutation:

```typescript
  inviteMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Verify user is owner or admin
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        throw new Error("Hanya pemilik atau admin yang dapat mengundang anggota");
      }

      // 2. Check if email is registered
      const targetUser = await db.query.user.findFirst({
        where: eq(user.email, input.email),
      });

      if (!targetUser) {
        throw new Error("Pengguna belum terdaftar di aplikasi");
      }

      // 3. Check if already a member
      const existingMember = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, targetUser.id),
        ),
      });

      if (existingMember) {
        throw new Error("Pengguna sudah menjadi anggota workspace ini");
      }

      // 4. Check if pending invitation exists
      const existingInvite = await db.query.invitation.findFirst({
        where: and(
          eq(invitation.workspaceId, input.workspaceId),
          eq(invitation.email, input.email),
          eq(invitation.status, "pending"),
        ),
      });

      if (existingInvite) {
        throw new Error("Undangan sudah dikirim dan sedang menunggu konfirmasi");
      }

      // 5. Create invitation
      const [newInvite] = await db
        .insert(invitation)
        .values({
          workspaceId: input.workspaceId,
          email: input.email,
          role: "member",
          invitedBy: ctx.session.user.id,
        })
        .returning();

      return newInvite;
    }),
```

**Step 2: Add `getPendingInvitations` and `respondToInvitation`**

```typescript
  getPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    // We need user email to find invitations
    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, ctx.session.user.id)
    });

    if (!currentUser) throw new Error("User not found");

    return db.query.invitation.findMany({
      where: and(
        eq(invitation.email, currentUser.email),
        eq(invitation.status, "pending")
      ),
      with: {
        workspace: {
          columns: {
            name: true,
            icon: true,
          }
        },
        inviter: {
          columns: {
            name: true,
          }
        }
      },
      orderBy: [desc(invitation.createdAt)]
    });
  }),

  respondToInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.string().uuid(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = await db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id)
      });

      if (!currentUser) throw new Error("User not found");

      // Verify invitation exists and belongs to user
      const invite = await db.query.invitation.findFirst({
        where: and(
          eq(invitation.id, input.invitationId),
          eq(invitation.email, currentUser.email),
          eq(invitation.status, "pending")
        )
      });

      if (!invite) {
        throw new Error("Undangan tidak valid atau sudah kadaluarsa");
      }

      await db.transaction(async (tx) => {
        // Update invitation status
        await tx.update(invitation)
          .set({
            status: input.accept ? "accepted" : "rejected",
            updatedAt: new Date()
          })
          .where(eq(invitation.id, input.invitationId));

        // If accepted, add to workspace
        if (input.accept) {
          await tx.insert(workspaceMember).values({
            workspaceId: invite.workspaceId,
            userId: ctx.session.user.id,
            role: invite.role,
          });
        }
      });

      return { success: true };
    }),
```

**Step 3: Typecheck & Commit**

Run: `pnpm typecheck`

```bash
git add src/server/api/routers/workspace.ts
git commit -m "feat(api): add workspace invitation procedures"
```

### Task 3: Wire up InviteMemberDrawer

**Files:**
- Modify: `src/components/workspace/InviteMemberDrawer.tsx`

**Step 1: Implement the logic in the drawer**

Update `InviteMemberDrawer.tsx` to use the mutation, show loading states, and handle errors.

```tsx
import { Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";

// Inside component:
  const { workspaceId } = useActiveWorkspace();
  const utils = api.useUtils();
  const [error, setError] = useState("");

  const inviteMember = api.workspace.inviteMember.useMutation({
    onSuccess: () => {
      setEmail("");
      setError("");
      onOpenChange(false);
      // Optional: show success toast
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  const handleSubmit = () => {
    if (email.trim().length === 0 || !workspaceId) return;
    setError("");
    inviteMember.mutate({ workspaceId, email: email.trim() });
  };

// Add error display above the input:
  {error && <p className="text-sm text-destructive">{error}</p>}

// Update button:
  disabled={email.trim().length === 0 || inviteMember.isPending}
  // show Loader2 when pending
```

**Step 2: Commit**

```bash
git add src/components/workspace/InviteMemberDrawer.tsx
git commit -m "feat(ui): wire up invite member drawer logic"
```

### Task 4: Add Invitations to Profile Page

**Files:**
- Modify: `src/app/profile/page.tsx`
- Create: `src/app/profile/invitations/page.tsx`

**Step 1: Add link to Profile Page**

In `src/app/profile/page.tsx`, fetch `api.workspace.getPendingInvitations.useQuery()` (turn component into Client Component or use Server call if you prefer, but Client is easier for live updates).

Actually, `profile/page.tsx` is an async Server Component. Let's create a Client Component wrapper `PendingInvitationsLink.tsx` to show the notification badge, OR just make it static and fetch on the next page.
Let's keep it simple: Add a static link in `profile/page.tsx` with a Mail icon:

```tsx
import { Mail } from "lucide-react";

<Link
  href="/profile/invitations"
  className="flex items-center gap-4 rounded-2xl bg-card p-4 transition-colors active:bg-muted/50"
>
  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
    <Mail size={20} />
  </div>
  <div className="min-w-0 flex-1">
    <p className="text-sm font-semibold text-foreground">Undangan Workspace</p>
    <p className="text-[11px] text-muted-foreground mt-0.5">Lihat dan kelola undangan masuk</p>
  </div>
  <ChevronRight size={16} className="text-muted-foreground/50 flex-shrink-0" />
</Link>
```

**Step 2: Create Invitations Page**

Create `src/app/profile/invitations/page.tsx` as a Client Component.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function InvitationsPage() {
  const router = useRouter();
  const utils = api.useUtils();

  const { data: invitations, isLoading } = api.workspace.getPendingInvitations.useQuery();
  const respond = api.workspace.respondToInvitation.useMutation({
    onSuccess: () => {
      utils.workspace.getPendingInvitations.invalidate();
      utils.workspace.getWorkspaces.invalidate();
    }
  });

  return (
    <>
      <PageHeader variant="back" title="Undangan" onBack={() => router.back()} />
      <div className="px-5 pt-4 space-y-4">
        {isLoading && <Loader2 className="animate-spin mx-auto text-primary" />}

        {!isLoading && invitations?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">Tidak ada undangan baru</p>
        )}

        {invitations?.map((inv) => (
          <div key={inv.id} className="rounded-[20px] bg-card p-5 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">{inv.workspace.icon}</div>
              <div>
                <h3 className="font-bold">{inv.workspace.name}</h3>
                <p className="text-xs text-muted-foreground">Dari: {inv.inviter.name}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 rounded-xl bg-primary"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invitationId: inv.id, accept: true })}
              >
                Terima
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ invitationId: inv.id, accept: false })}
              >
                Tolak
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/profile/page.tsx src/app/profile/invitations/page.tsx
git commit -m "feat(ui): add invitations page to accept/reject invites"
```
