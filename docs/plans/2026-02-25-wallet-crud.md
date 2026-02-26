# Wallet CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect wallet UI to database via tRPC, fixing existing router bugs and adding create/edit/delete modals.

**Architecture:** Fix the existing wallet tRPC router (broken Drizzle queries), add a workspace bootstrap procedure, then wire the existing wallet pages to real data. New sheet modals handle create/edit/delete flows.

**Tech Stack:** Next.js 15, tRPC v11, Drizzle ORM, React Hook Form, Zod, shadcn/ui (Sheet, AlertDialog, Select), Tailwind CSS v4

---

### Task 1: Add `workspace.getOrCreateDefault` procedure

**Files:**
- Modify: `src/server/api/routers/workspace.ts`

**Step 1: Add the `getOrCreateDefault` procedure**

Add this procedure to the `workspaceRouter` object, after the existing `deleteWorkspace` procedure:

```typescript
  /**
   * Get or create a default workspace for the current user.
   * If the user has no workspaces, creates a "Personal" workspace.
   */
  getOrCreateDefault: protectedProcedure.query(async ({ ctx }) => {
    // Check if user already has a workspace
    const existingMembership = await db.query.workspaceMember.findFirst({
      where: eq(workspaceMember.userId, ctx.session.user.id),
    });

    if (existingMembership) {
      const existingWorkspace = await db.query.workspace.findFirst({
        where: eq(workspace.id, existingMembership.workspaceId),
      });
      if (existingWorkspace) return existingWorkspace;
    }

    // Create default workspace
    const workspaceId = crypto.randomUUID();

    const [newWorkspace] = await db
      .insert(workspace)
      .values({
        id: workspaceId,
        name: "Personal",
        icon: "💼",
        ownerId: ctx.session.user.id,
      })
      .returning();

    // Add owner as member
    await db.insert(workspaceMember).values({
      workspaceId,
      userId: ctx.session.user.id,
      role: "owner",
    });

    return newWorkspace!;
  }),
```

**Step 2: Verify the file compiles**

Run: `pnpm typecheck`
Expected: No errors related to workspace router

**Step 3: Commit**

```bash
git add src/server/api/routers/workspace.ts
git commit -m "feat: add workspace.getOrCreateDefault procedure"
```

---

### Task 2: Fix wallet tRPC router

**Files:**
- Modify: `src/server/api/routers/wallet.ts`

**Step 1: Rewrite the entire wallet router with fixed Drizzle queries**

Replace the full contents of `src/server/api/routers/wallet.ts` with:

```typescript
import { z } from "zod";
import { and, eq, desc, sql, isNull, inArray } from "drizzle-orm";
import { db } from "@/server/db";

import {
  wallet,
  workspaceMember,
  transaction as transactionSchema,
} from "@/server/db/schema";

import { protectedProcedure } from "@/server/api/trpc";

/**
 * Wallet tRPC Router
 * Handles wallet management operations
 */
export const walletRouter = {
  /**
   * Get all wallets for the current user (workspace-scoped)
   */
  getWallets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Build where conditions
      const conditions = [eq(wallet.workspaceId, input.workspaceId)];
      if (!input.includeArchived) {
        conditions.push(eq(wallet.isArchived, false));
      }

      const wallets = await db.query.wallet.findMany({
        where: and(...conditions),
        orderBy: [desc(wallet.createdAt)],
      });

      return wallets;
    }),

  /**
   * Get a single wallet by ID with details
   */
  getWallet: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const walletData = await db.query.wallet.findFirst({
        where: eq(wallet.id, input.id),
      });

      if (!walletData) {
        throw new Error("Wallet not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, walletData.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Get recent transactions (exclude soft-deleted)
      const recentTransactions = await db.query.transaction.findMany({
        where: and(
          eq(transactionSchema.walletId, input.id),
          isNull(transactionSchema.deletedAt),
        ),
        orderBy: [desc(transactionSchema.date)],
        limit: 20,
      });

      // Calculate monthly income/expense
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const monthlyResult = await db
        .select({
          monthIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactionSchema.type} = 'income' THEN ${transactionSchema.amount} ELSE 0 END), 0)`,
          monthExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transactionSchema.type} = 'expense' THEN ${transactionSchema.amount} ELSE 0 END), 0)`,
        })
        .from(transactionSchema)
        .where(
          and(
            eq(transactionSchema.walletId, input.id),
            isNull(transactionSchema.deletedAt),
            sql`EXTRACT(YEAR FROM ${transactionSchema.date}::timestamp) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${transactionSchema.date}::timestamp) = ${currentMonth}`,
          ),
        );

      const monthly = monthlyResult[0];

      return {
        ...walletData,
        transactions: recentTransactions,
        monthlyIncome: parseFloat(monthly?.monthIncome ?? "0"),
        monthlyExpense: parseFloat(monthly?.monthExpense ?? "0"),
      };
    }),

  /**
   * Create a new wallet
   */
  createWallet: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(["cash", "bank", "ewallet", "savings", "investment"]),
        icon: z.string().min(1).max(50).default("💰"),
        workspaceId: z.string().uuid(),
        initialBalance: z.number().nonnegative().optional().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify workspace access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      const [newWallet] = await db
        .insert(wallet)
        .values({
          name: input.name,
          type: input.type,
          icon: input.icon,
          balance: input.initialBalance.toFixed(2),
          currency: "IDR",
          workspaceId: input.workspaceId,
        })
        .returning();

      return newWallet!;
    }),

  /**
   * Update a wallet
   */
  updateWallet: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        icon: z.string().min(1).max(50).optional(),
        isArchived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const walletData = await db.query.wallet.findFirst({
        where: eq(wallet.id, input.id),
      });

      if (!walletData) {
        throw new Error("Wallet not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, walletData.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      if (member.role !== "owner" && member.role !== "admin") {
        throw new Error("Only workspace owners and admins can update wallets");
      }

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;

      const [updated] = await db
        .update(wallet)
        .set(updateData)
        .where(eq(wallet.id, input.id))
        .returning();

      return updated!;
    }),

  /**
   * Delete a wallet (soft delete / archive)
   */
  deleteWallet: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const walletData = await db.query.wallet.findFirst({
        where: eq(wallet.id, input.id),
      });

      if (!walletData) {
        throw new Error("Wallet not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, walletData.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      if (member.role !== "owner" && member.role !== "admin") {
        throw new Error("Only workspace owners and admins can delete wallets");
      }

      await db
        .update(wallet)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(eq(wallet.id, input.id));

      return { success: true };
    }),
};
```

**Step 2: Verify compilation**

Run: `pnpm typecheck`
Expected: No errors in wallet router

**Step 3: Commit**

```bash
git add src/server/api/routers/wallet.ts
git commit -m "fix: rewrite wallet tRPC router with correct Drizzle queries"
```

---

### Task 3: Create `WalletEmojiPicker` component

**Files:**
- Create: `src/components/wallets/WalletEmojiPicker.tsx`

**Step 1: Create the emoji picker component**

```tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";

const WALLET_EMOJIS: Record<string, string[]> = {
  cash: ["💵", "💰", "🪙", "💲", "🏧"],
  bank: ["🏦", "💳", "🏛️"],
  ewallet: ["📱", "💸", "⚡"],
  savings: ["🐷", "🏠", "🎓", "✈️"],
  investment: ["📈", "📊", "💎", "🏆"],
};

interface WalletEmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  walletType?: string;
}

/**
 * Grid of preset wallet-related emojis.
 * Highlights emojis matching the selected wallet type.
 */
export function WalletEmojiPicker({
  value,
  onChange,
  walletType,
}: WalletEmojiPickerProps) {
  // Show type-specific emojis first, then all others
  const typeEmojis = walletType ? WALLET_EMOJIS[walletType] ?? [] : [];
  const otherEmojis = Object.entries(WALLET_EMOJIS)
    .filter(([key]) => key !== walletType)
    .flatMap(([, emojis]) => emojis);

  const allEmojis = [...typeEmojis, ...otherEmojis];

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {allEmojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-colors",
            value === emoji
              ? "bg-primary/10 ring-2 ring-primary"
              : "bg-muted hover:bg-muted-foreground/10",
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify compilation**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/wallets/WalletEmojiPicker.tsx
git commit -m "feat: add WalletEmojiPicker component"
```

---

### Task 4: Create `CreateWalletSheet` component

**Files:**
- Create: `src/components/wallets/CreateWalletSheet.tsx`

**Step 1: Create the sheet component**

```tsx
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WalletEmojiPicker } from "./WalletEmojiPicker";
import { api } from "@/trpc/react";

const WALLET_TYPES = [
  { value: "cash", label: "Tunai" },
  { value: "bank", label: "Rekening Bank" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "savings", label: "Tabungan" },
  { value: "investment", label: "Investasi" },
] as const;

const createWalletSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(255),
  type: z.enum(["cash", "bank", "ewallet", "savings", "investment"]),
  icon: z.string().min(1),
  initialBalance: z.number().nonnegative("Saldo tidak boleh negatif"),
});

type CreateWalletForm = z.infer<typeof createWalletSchema>;

interface CreateWalletSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function CreateWalletSheet({
  open,
  onOpenChange,
  workspaceId,
}: CreateWalletSheetProps) {
  const utils = api.useUtils();

  const form = useForm<CreateWalletForm>({
    resolver: zodResolver(createWalletSchema),
    defaultValues: {
      name: "",
      type: "cash",
      icon: "💰",
      initialBalance: 0,
    },
  });

  const createMutation = api.wallet.createWallet.useMutation({
    onSuccess: () => {
      void utils.wallet.getWallets.invalidate();
      form.reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: CreateWalletForm) => {
    createMutation.mutate({
      ...data,
      workspaceId,
    });
  };

  const selectedType = form.watch("type");
  const selectedIcon = form.watch("icon");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] px-5 pb-8">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-[22px] font-bold">
            Tambah Dompet
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Nama Dompet
            </Label>
            <Input
              {...form.register("name")}
              placeholder="Contoh: BCA, GoPay, Tunai"
              className="h-12 rounded-2xl"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Tipe
            </Label>
            <Select
              value={selectedType}
              onValueChange={(v) =>
                form.setValue(
                  "type",
                  v as CreateWalletForm["type"],
                )
              }
            >
              <SelectTrigger className="h-12 rounded-2xl">
                <SelectValue placeholder="Pilih tipe dompet" />
              </SelectTrigger>
              <SelectContent>
                {WALLET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Ikon
            </Label>
            <WalletEmojiPicker
              value={selectedIcon}
              onChange={(emoji) => form.setValue("icon", emoji)}
              walletType={selectedType}
            />
          </div>

          {/* Initial Balance */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Saldo Awal (IDR)
            </Label>
            <Input
              type="number"
              min={0}
              step="1"
              {...form.register("initialBalance", { valueAsNumber: true })}
              placeholder="0"
              className="h-12 rounded-2xl"
            />
            {form.formState.errors.initialBalance && (
              <p className="text-xs text-destructive">
                {form.formState.errors.initialBalance.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="h-12 w-full rounded-full text-base font-semibold active:scale-[0.97] transition-transform duration-150"
          >
            {createMutation.isPending ? "Menyimpan..." : "Simpan Dompet"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify compilation**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/wallets/CreateWalletSheet.tsx
git commit -m "feat: add CreateWalletSheet component"
```

---

### Task 5: Create `EditWalletSheet` component

**Files:**
- Create: `src/components/wallets/EditWalletSheet.tsx`

**Step 1: Create the edit sheet component**

```tsx
"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletEmojiPicker } from "./WalletEmojiPicker";
import { api } from "@/trpc/react";

const editWalletSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(255),
  icon: z.string().min(1),
});

type EditWalletForm = z.infer<typeof editWalletSchema>;

interface EditWalletSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: {
    id: string;
    name: string;
    icon: string;
    type: string;
  } | null;
}

export function EditWalletSheet({
  open,
  onOpenChange,
  wallet,
}: EditWalletSheetProps) {
  const utils = api.useUtils();

  const form = useForm<EditWalletForm>({
    resolver: zodResolver(editWalletSchema),
    defaultValues: {
      name: "",
      icon: "💰",
    },
  });

  // Reset form when wallet changes
  useEffect(() => {
    if (wallet) {
      form.reset({
        name: wallet.name,
        icon: wallet.icon,
      });
    }
  }, [wallet, form]);

  const updateMutation = api.wallet.updateWallet.useMutation({
    onSuccess: () => {
      void utils.wallet.getWallets.invalidate();
      void utils.wallet.getWallet.invalidate();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: EditWalletForm) => {
    if (!wallet) return;
    updateMutation.mutate({
      id: wallet.id,
      ...data,
    });
  };

  const selectedIcon = form.watch("icon");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] px-5 pb-8">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-[22px] font-bold">
            Edit Dompet
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Nama Dompet
            </Label>
            <Input
              {...form.register("name")}
              placeholder="Nama dompet"
              className="h-12 rounded-2xl"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Ikon
            </Label>
            <WalletEmojiPicker
              value={selectedIcon}
              onChange={(emoji) => form.setValue("icon", emoji)}
              walletType={wallet?.type}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="h-12 w-full rounded-full text-base font-semibold active:scale-[0.97] transition-transform duration-150"
          >
            {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Verify compilation**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/wallets/EditWalletSheet.tsx
git commit -m "feat: add EditWalletSheet component"
```

---

### Task 6: Create `DeleteWalletDialog` component

**Files:**
- Create: `src/components/wallets/DeleteWalletDialog.tsx`

**Step 1: Create the delete confirmation dialog**

```tsx
"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatIDR } from "@/lib/formatIDR";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";

interface DeleteWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: {
    id: string;
    name: string;
    balance: string;
  } | null;
}

export function DeleteWalletDialog({
  open,
  onOpenChange,
  wallet,
}: DeleteWalletDialogProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const deleteMutation = api.wallet.deleteWallet.useMutation({
    onSuccess: () => {
      void utils.wallet.getWallets.invalidate();
      onOpenChange(false);
      router.push("/wallets");
    },
  });

  const handleDelete = () => {
    if (!wallet) return;
    deleteMutation.mutate({ id: wallet.id });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[20px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Arsipkan Dompet?</AlertDialogTitle>
          <AlertDialogDescription>
            Dompet <strong>{wallet?.name}</strong> dengan saldo{" "}
            <strong>{formatIDR(parseFloat(wallet?.balance ?? "0"))}</strong> akan
            diarsipkan. Dompet yang diarsipkan tidak akan tampil di daftar
            utama.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Mengarsipkan..." : "Arsipkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Verify compilation**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/wallets/DeleteWalletDialog.tsx
git commit -m "feat: add DeleteWalletDialog component"
```

---

### Task 7: Wire `/wallets` page to tRPC

**Files:**
- Modify: `src/app/wallets/page.tsx`
- Modify: `src/components/wallets/WalletListItem.tsx`

**Step 1: Update `WalletListItem` to accept real wallet data shape**

The balance from Drizzle is a `string` (numeric type). Update the interface:

In `src/components/wallets/WalletListItem.tsx`, change the interface:

```typescript
interface WalletListItemProps {
  wallet: {
    id: string;
    name: string;
    type: string;
    icon: string;
    balance: string;
  };
  isFirst?: boolean;
  onClick: () => void;
}
```

And update the component to use the emoji icon and parse balance:

Replace the Icon line and balance display:

```tsx
// Replace the icon div with emoji:
<div
  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${
    isFirst ? "bg-primary/10" : "bg-muted"
  }`}
>
  <span className="text-xl">{wallet.icon}</span>
</div>
```

And for balance:
```tsx
<p className="text-base font-bold text-foreground">
  {formatIDR(parseFloat(wallet.balance))}
</p>
```

Remove the `transactionCount` line and the lucide icon imports that are no longer needed.

**Step 2: Rewrite the wallets page**

Replace the full contents of `src/app/wallets/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { WalletListItem } from "@/components/wallets/WalletListItem";
import { CreateWalletSheet } from "@/components/wallets/CreateWalletSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Wallet } from "lucide-react";
import { api } from "@/trpc/react";
import { useState } from "react";

/**
 * Wallets list page — shows all wallets in the active workspace.
 */
export default function WalletsPage() {
  const router = useRouter();
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // Bootstrap workspace
  const { data: workspace, isLoading: workspaceLoading } =
    api.workspace.getOrCreateDefault.useQuery();

  // Fetch wallets once workspace is available
  const { data: wallets, isLoading: walletsLoading } =
    api.wallet.getWallets.useQuery(
      { workspaceId: workspace?.id ?? "" },
      { enabled: !!workspace?.id },
    );

  const isLoading = workspaceLoading || walletsLoading;

  return (
    <AppShell>
      <PageHeader
        title="Dompet"
        rightSlot={
          <span className="text-sm text-muted-foreground">
            {workspace?.name ?? ""}
          </span>
        }
      />
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 space-y-3 px-5 pb-28">
        {/* Loading State */}
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[20px]" />
          ))}

        {/* Empty State */}
        {!isLoading && wallets && wallets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Wallet size={28} className="text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Belum ada dompet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambahkan dompet pertama Anda untuk mulai mencatat keuangan.
            </p>
          </div>
        )}

        {/* Wallet List */}
        {!isLoading &&
          wallets?.map((w, index) => (
            <div
              key={w.id}
              className="animate-in fade-in slide-in-from-bottom-1"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <WalletListItem
                wallet={w}
                isFirst={index === 0}
                onClick={() => router.push(`/wallets/${w.id}`)}
              />
            </div>
          ))}

        {/* Add Wallet Button */}
        {!isLoading && (
          <Button
            variant="outline"
            className="h-14 w-full rounded-[20px] border-dashed border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5"
            onClick={() => setShowCreateSheet(true)}
          >
            <Plus size={18} className="mr-2" />
            Tambah Dompet
          </Button>
        )}
      </div>

      {/* Create Wallet Sheet */}
      {workspace && (
        <CreateWalletSheet
          open={showCreateSheet}
          onOpenChange={setShowCreateSheet}
          workspaceId={workspace.id}
        />
      )}
    </AppShell>
  );
}
```

**Step 3: Verify compilation**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/wallets/page.tsx src/components/wallets/WalletListItem.tsx
git commit -m "feat: wire wallets list page to tRPC with create sheet"
```

---

### Task 8: Wire `/wallets/[id]` detail page to tRPC

**Files:**
- Modify: `src/app/wallets/[id]/page.tsx`
- Modify: `src/components/wallets/WalletActions.tsx`

**Step 1: Add delete action to WalletActions**

In `src/components/wallets/WalletActions.tsx`, add a delete button:

```tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Pencil, Trash2 } from "lucide-react";

interface WalletActionsProps {
  onTransfer: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Action buttons on Wallet Detail: Transfer, Edit, and Delete.
 */
export function WalletActions({ onTransfer, onEdit, onDelete }: WalletActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Button
        onClick={onTransfer}
        className="h-11 rounded-full text-sm font-semibold active:scale-[0.97] transition-transform duration-150"
      >
        <ArrowRightLeft size={16} className="mr-2" />
        Transfer
      </Button>
      <Button
        variant="outline"
        onClick={onEdit}
        className="h-11 rounded-full border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5 active:scale-[0.97] transition-transform duration-150"
      >
        <Pencil size={16} className="mr-2" />
        Edit
      </Button>
      <Button
        variant="outline"
        onClick={onDelete}
        className="h-11 rounded-full border-destructive/40 text-sm font-semibold text-destructive hover:bg-destructive/5 active:scale-[0.97] transition-transform duration-150"
      >
        <Trash2 size={16} className="mr-2" />
        Hapus
      </Button>
    </div>
  );
}
```

**Step 2: Rewrite the wallet detail page**

Replace the full contents of `src/app/wallets/[id]/page.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { WalletBalanceCard } from "@/components/wallets/WalletBalanceCard";
import { WalletActions } from "@/components/wallets/WalletActions";
import { WalletMonthlySummary } from "@/components/wallets/WalletMonthlySummary";
import { WalletTransactionList } from "@/components/wallets/WalletTransactionList";
import { EditWalletSheet } from "@/components/wallets/EditWalletSheet";
import { DeleteWalletDialog } from "@/components/wallets/DeleteWalletDialog";
import { AddTransactionSheet } from "@/components/transaction/AddTransactionSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";

const WALLET_TYPE_LABELS: Record<string, string> = {
  cash: "Tunai",
  bank: "Rekening Bank",
  ewallet: "E-Wallet",
  savings: "Tabungan",
  investment: "Investasi",
};

/**
 * Wallet Detail page — shows balance, actions, monthly summary, and transactions.
 */
export default function WalletDetailPage() {
  const params = useParams();
  const walletId = params.id as string;
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: walletData, isLoading } = api.wallet.getWallet.useQuery({
    id: walletId,
  });

  if (isLoading) {
    return (
      <AppShell>
        <PageHeader variant="back" title="..." />
        <div className="space-y-4 px-5 pb-28">
          <Skeleton className="h-[120px] rounded-[20px]" />
          <Skeleton className="h-[44px] rounded-full" />
          <Skeleton className="h-[100px] rounded-[20px]" />
          <Skeleton className="h-[200px] rounded-[20px]" />
        </div>
      </AppShell>
    );
  }

  if (!walletData) {
    return (
      <AppShell>
        <PageHeader variant="back" title="Dompet" />
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Dompet tidak ditemukan</p>
        </div>
      </AppShell>
    );
  }

  const typeLabel = WALLET_TYPE_LABELS[walletData.type] ?? walletData.type;

  // Map transactions to the format WalletTransactionList expects
  const mappedTransactions = walletData.transactions.map((tx) => ({
    id: tx.id,
    name: tx.name,
    category: "", // Category is not joined yet, show empty
    date: new Date(tx.date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    }),
    amount: parseFloat(tx.amount),
    type: tx.type as "income" | "expense",
  }));

  const now = new Date();
  const monthLabel = now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell>
      <PageHeader variant="back" title={walletData.name} />

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 space-y-6 px-5 pb-28">
        {/* Balance Card */}
        <WalletBalanceCard
          balance={parseFloat(walletData.balance)}
          walletType={typeLabel}
        />

        {/* Action Buttons */}
        <WalletActions
          onTransfer={() => setShowTransactionSheet(true)}
          onEdit={() => setShowEditSheet(true)}
          onDelete={() => setShowDeleteDialog(true)}
        />

        {/* Monthly Summary */}
        <WalletMonthlySummary
          income={walletData.monthlyIncome}
          expense={walletData.monthlyExpense}
        />

        {/* Transaction List */}
        <WalletTransactionList
          transactions={mappedTransactions}
          monthLabel={monthLabel}
        />
      </div>

      {/* Sheets & Dialogs */}
      <AddTransactionSheet
        open={showTransactionSheet}
        onOpenChange={setShowTransactionSheet}
      />

      <EditWalletSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        wallet={walletData}
      />

      <DeleteWalletDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        wallet={walletData}
      />
    </AppShell>
  );
}
```

**Step 3: Verify compilation**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/wallets/[id]/page.tsx src/components/wallets/WalletActions.tsx
git commit -m "feat: wire wallet detail page to tRPC with edit/delete"
```

---

### Task 9: Final verification

**Step 1: Run full type check**

Run: `pnpm typecheck`
Expected: All passes

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors (fix any if found)

**Step 3: Test dev server starts**

Run: `pnpm dev`
Expected: Server starts without errors

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint and type errors from wallet CRUD integration"
```
