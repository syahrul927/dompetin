# Split Bill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Split Bill feature that lets users input a bill (manually or via AI receipt scan), divide items among participants, preview each person's share, save to DB, and share a public link.

**Architecture:** Multi-page flow at `/split-bill/new/*` with React Context for state management across steps. New DB tables (`dompetin_split_bill`, `dompetin_split_bill_participant`) store completed bills. Public share page at `/s/[code]` bypasses auth middleware. AI receipt scan returns itemized data via new Groq Vision endpoint.

**Tech Stack:** Next.js 15 App Router, tRPC, Drizzle ORM, Groq Vision API, React Context + useReducer, nanoid, Tailwind CSS + shadcn/ui

**Design doc:** `docs/plans/2026-03-05-split-bill-design.md`

---

### Task 1: Database Schema

**Files:**
- Modify: `src/server/db/dompetin-schema.ts`

**Step 1: Add split bill tables and relations**

Add after the `goal` table definition (after line 329):

```typescript
// Split Bills
export const splitBill = pgTable("dompetin_split_bill", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  shareCode: varchar("share_code", { length: 16 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  workspaceId: uuidColumn("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "set null" }),
  transactionId: uuidColumn("transaction_id").references(() => transaction.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const splitBillParticipant = pgTable("dompetin_split_bill_participant", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  splitBillId: uuidColumn("split_bill_id")
    .notNull()
    .references(() => splitBill.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  isOwner: boolean("is_owner")
    .$defaultFn(() => false)
    .notNull(),
  items: text("items").notNull(), // JSON string: [{ name, qty, price, subtotal }]
  taxShare: numeric("tax_share", { precision: 15, scale: 2 }).notNull().default("0"),
  discountShare: numeric("discount_share", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});
```

Note: Use `text` for `items` column storing JSON string (Drizzle doesn't have native jsonb in the current project pattern — parse with `JSON.parse()` on read). Alternatively use `jsonb` from `drizzle-orm/pg-core` if available — check the import.

Add relations after the existing `goalRelations`:

```typescript
export const splitBillRelations = relations(splitBill, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [splitBill.workspaceId],
    references: [workspace.id],
  }),
  createdBy: one(user, {
    fields: [splitBill.createdBy],
    references: [user.id],
  }),
  transaction: one(transaction, {
    fields: [splitBill.transactionId],
    references: [transaction.id],
  }),
  participants: many(splitBillParticipant),
}));

export const splitBillParticipantRelations = relations(splitBillParticipant, ({ one }) => ({
  splitBill: one(splitBill, {
    fields: [splitBillParticipant.splitBillId],
    references: [splitBill.id],
  }),
}));
```

Also add `splitBills: many(splitBill)` to `workspaceRelations`.

**Step 2: Generate and apply migration**

Run:
```bash
pnpm db:generate
pnpm db:push
```

**Step 3: Commit**

```bash
git add src/server/db/dompetin-schema.ts drizzle/
git commit -m "feat(split-bill): add split bill database schema"
```

---

### Task 2: Install nanoid

**Step 1: Install nanoid**

```bash
pnpm add nanoid
```

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add nanoid dependency for split bill share codes"
```

---

### Task 3: tRPC Split Bill Router

**Files:**
- Create: `src/server/api/routers/split-bill.ts`
- Modify: `src/server/api/root.ts`

**Step 1: Create the router**

Create `src/server/api/routers/split-bill.ts`:

```typescript
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import {
  splitBill,
  splitBillParticipant,
  workspaceMember,
  transaction,
  wallet,
} from "@/server/db/dompetin-schema";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

const participantItemSchema = z.object({
  name: z.string(),
  qty: z.number(),
  price: z.number(),
  subtotal: z.number(),
});

const participantSchema = z.object({
  name: z.string(),
  isOwner: z.boolean(),
  items: z.array(participantItemSchema),
  taxShare: z.number(),
  discountShare: z.number(),
  total: z.number(),
});

export const splitBillRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        title: z.string().max(255),
        subtotal: z.number(),
        tax: z.number(),
        discount: z.number(),
        total: z.number(),
        participants: z.array(participantSchema),
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
      if (!member) throw new Error("Access denied to this workspace");

      const shareCode = nanoid(8);

      const [bill] = await db
        .insert(splitBill)
        .values({
          shareCode,
          title: input.title,
          subtotal: input.subtotal.toString(),
          tax: input.tax.toString(),
          discount: input.discount.toString(),
          total: input.total.toString(),
          workspaceId: input.workspaceId,
          createdBy: ctx.session.user.id,
        })
        .returning();

      if (!bill) throw new Error("Failed to create split bill");

      await db.insert(splitBillParticipant).values(
        input.participants.map((p) => ({
          splitBillId: bill.id,
          name: p.name,
          isOwner: p.isOwner,
          items: JSON.stringify(p.items),
          taxShare: p.taxShare.toString(),
          discountShare: p.discountShare.toString(),
          total: p.total.toString(),
        })),
      );

      return { id: bill.id, shareCode };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bill = await db.query.splitBill.findFirst({
        where: eq(splitBill.id, input.id),
        with: { participants: true },
      });

      if (!bill) throw new Error("Split bill not found");

      // Verify workspace access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, bill.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });
      if (!member) throw new Error("Access denied");

      return {
        ...bill,
        participants: bill.participants.map((p) => ({
          ...p,
          items: JSON.parse(p.items) as z.infer<typeof participantItemSchema>[],
        })),
      };
    }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const bill = await db.query.splitBill.findFirst({
        where: eq(splitBill.shareCode, input.code),
        with: { participants: true },
      });

      if (!bill) throw new Error("Split bill not found");

      return {
        ...bill,
        participants: bill.participants.map((p) => ({
          ...p,
          items: JSON.parse(p.items) as z.infer<typeof participantItemSchema>[],
        })),
      };
    }),

  addToTransaction: protectedProcedure
    .input(
      z.object({
        splitBillId: z.string().uuid(),
        walletId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bill = await db.query.splitBill.findFirst({
        where: eq(splitBill.id, input.splitBillId),
        with: { participants: true },
      });

      if (!bill) throw new Error("Split bill not found");

      // Find the owner participant
      const ownerParticipant = bill.participants.find((p) => p.isOwner);
      if (!ownerParticipant) throw new Error("Owner participant not found");

      const amount = parseFloat(ownerParticipant.total);
      const amountInCents = Math.round(amount * 100);

      // Create expense transaction
      const [tx] = await db
        .insert(transaction)
        .values({
          type: "expense",
          amount: (-amountInCents).toString(),
          name: `Split Bill - ${bill.title}`,
          notes: `Bagian kamu dari split bill "${bill.title}"`,
          date: new Date(),
          walletId: input.walletId,
          categoryId: input.categoryId,
          workspaceId: bill.workspaceId,
          createdBy: ctx.session.user.id,
          isCorrection: false,
          isTransferFee: false,
        })
        .returning();

      if (!tx) throw new Error("Failed to create transaction");

      // Link transaction to split bill
      await db
        .update(splitBill)
        .set({ transactionId: tx.id })
        .where(eq(splitBill.id, input.splitBillId));

      // Update wallet balance
      await db
        .update(wallet)
        .set({
          balance: sql`${wallet.balance} - ${amountInCents}`,
        })
        .where(eq(wallet.id, input.walletId));

      return { transactionId: tx.id };
    }),
});
```

Note: The `addToTransaction` mutation needs `sql` imported from `drizzle-orm`. Add it to the imports.

**Step 2: Register router in root**

In `src/server/api/root.ts`, add:

```typescript
import { splitBillRouter } from "./routers/split-bill";
```

And in the `createTRPCRouter` call:

```typescript
splitBill: splitBillRouter,
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/server/api/routers/split-bill.ts src/server/api/root.ts
git commit -m "feat(split-bill): add tRPC router with create, get, share, and addToTransaction"
```

---

### Task 4: AI Receipt Items Endpoint

**Files:**
- Modify: `src/server/api/routers/ai.ts`

**Step 1: Add the scanReceiptItems procedure**

Add after the `parseTransactionText` procedure in `ai.ts`:

```typescript
const receiptItemsSchema = z.object({
  success: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string(),
        qty: z.number(),
        price: z.number(),
      }),
    )
    .nullable(),
  tax: z.number().nullable(),
  discount: z.number().nullable(),
});

// Inside the aiRouter, add:
scanReceiptItems: protectedProcedure
  .input(
    z.object({
      imageBase64: z.string(),
      mimeType: z.string(),
    }),
  )
  .mutation(async ({ input }) => {
    const groq = new Groq({ apiKey: env.GROQ_API_KEY });

    const systemPrompt = `You are a receipt parser for a personal finance app.
    Analyze the provided image of a receipt and extract INDIVIDUAL LINE ITEMS.
    Output strict JSON matching this exact schema:
    {
      "success": boolean,
      "items": [{ "name": string, "qty": number, "price": number }] | null,
      "tax": number | null,
      "discount": number | null
    }

    Rules:
    - "price" is the price PER UNIT (not total for qty), in whole IDR (no decimals)
    - "qty" is the quantity of each item (default 1 if not specified)
    - "tax" is the total tax/service charge amount in whole IDR, or null if none
    - "discount" is the total discount amount as a POSITIVE number in whole IDR, or null if none
    - If it is not a readable receipt, set success to false and items to null`;

    try {
      const result = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Please parse this receipt into individual items." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType};base64,${input.imageBase64}`,
                },
              },
            ],
          },
        ],
        model: "llama-3.2-11b-vision-preview",
        temperature: 0,
        response_format: { type: "json_object" },
      });

      const textResponse = result.choices[0]?.message?.content || "";
      const parsed = JSON.parse(textResponse);
      return receiptItemsSchema.parse(parsed);
    } catch (error) {
      console.error("Groq Receipt Items error:", error);
      return {
        success: false,
        items: null,
        tax: null,
        discount: null,
      };
    }
  }),
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/server/api/routers/ai.ts
git commit -m "feat(split-bill): add scanReceiptItems AI endpoint for itemized receipt parsing"
```

---

### Task 5: SplitBillProvider (React Context)

**Files:**
- Create: `src/components/split-bill/split-bill-context.tsx`

**Step 1: Create the context provider**

```typescript
"use client";

import React, { createContext, useContext, useReducer, type ReactNode } from "react";
import { nanoid } from "nanoid";

// Types
export interface BillItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export interface ParticipantAssignment {
  itemId: string;
  qty: number;
}

export interface Participant {
  id: string;
  name: string;
  isOwner: boolean;
  assignments: ParticipantAssignment[];
}

export interface SplitBillState {
  items: BillItem[];
  tax: number;
  discount: number;
  participants: Participant[];
}

// Actions
type Action =
  | { type: "ADD_ITEM" }
  | { type: "UPDATE_ITEM"; id: string; field: keyof Omit<BillItem, "id">; value: string | number }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "SET_TAX"; value: number }
  | { type: "SET_DISCOUNT"; value: number }
  | { type: "ADD_PARTICIPANT" }
  | { type: "REMOVE_PARTICIPANT"; id: string }
  | { type: "UPDATE_PARTICIPANT_NAME"; id: string; name: string }
  | { type: "SET_ASSIGNMENT"; participantId: string; itemId: string; qty: number }
  | { type: "SET_ITEMS_FROM_SCAN"; items: BillItem[]; tax: number; discount: number }
  | { type: "RESET" };

function createInitialState(): SplitBillState {
  return {
    items: [{ id: nanoid(), name: "", qty: 1, price: 0 }],
    tax: 0,
    discount: 0,
    participants: [
      { id: nanoid(), name: "Kamu", isOwner: true, assignments: [] },
    ],
  };
}

function reducer(state: SplitBillState, action: Action): SplitBillState {
  switch (action.type) {
    case "ADD_ITEM":
      return {
        ...state,
        items: [...state.items, { id: nanoid(), name: "", qty: 1, price: 0 }],
      };

    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, [action.field]: action.value } : item,
        ),
      };

    case "REMOVE_ITEM": {
      const newItems = state.items.filter((item) => item.id !== action.id);
      // Also remove assignments referencing this item
      const newParticipants = state.participants.map((p) => ({
        ...p,
        assignments: p.assignments.filter((a) => a.itemId !== action.id),
      }));
      return { ...state, items: newItems, participants: newParticipants };
    }

    case "SET_TAX":
      return { ...state, tax: action.value };

    case "SET_DISCOUNT":
      return { ...state, discount: action.value };

    case "ADD_PARTICIPANT":
      return {
        ...state,
        participants: [
          ...state.participants,
          { id: nanoid(), name: `Orang ${state.participants.length}`, isOwner: false, assignments: [] },
        ],
      };

    case "REMOVE_PARTICIPANT":
      return {
        ...state,
        participants: state.participants.filter(
          (p) => p.id !== action.id || p.isOwner,
        ),
      };

    case "UPDATE_PARTICIPANT_NAME":
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p,
        ),
      };

    case "SET_ASSIGNMENT": {
      return {
        ...state,
        participants: state.participants.map((p) => {
          if (p.id !== action.participantId) return p;
          const existing = p.assignments.findIndex((a) => a.itemId === action.itemId);
          let newAssignments = [...p.assignments];
          if (action.qty <= 0) {
            newAssignments = newAssignments.filter((a) => a.itemId !== action.itemId);
          } else if (existing >= 0) {
            newAssignments[existing] = { itemId: action.itemId, qty: action.qty };
          } else {
            newAssignments.push({ itemId: action.itemId, qty: action.qty });
          }
          return { ...p, assignments: newAssignments };
        }),
      };
    }

    case "SET_ITEMS_FROM_SCAN":
      return {
        ...state,
        items: action.items,
        tax: action.tax,
        discount: action.discount,
      };

    case "RESET":
      return createInitialState();

    default:
      return state;
  }
}

// Computed helpers
export function getItemSubtotal(item: BillItem): number {
  return item.qty * item.price;
}

export function getGrandSubtotal(items: BillItem[]): number {
  return items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
}

export function getFinalTotal(state: SplitBillState): number {
  return getGrandSubtotal(state.items) + state.tax - state.discount;
}

export function getParticipantShare(
  participant: Participant,
  state: SplitBillState,
): { itemsTotal: number; taxShare: number; discountShare: number; total: number } {
  const grandSubtotal = getGrandSubtotal(state.items);

  let itemsTotal = 0;
  for (const assignment of participant.assignments) {
    const item = state.items.find((i) => i.id === assignment.itemId);
    if (item) {
      itemsTotal += assignment.qty * item.price;
    }
  }

  const proportion = grandSubtotal > 0 ? itemsTotal / grandSubtotal : 0;
  const taxShare = Math.round(state.tax * proportion);
  const discountShare = Math.round(state.discount * proportion);
  const total = itemsTotal + taxShare - discountShare;

  return { itemsTotal, taxShare, discountShare, total };
}

export function getRemainingQty(itemId: string, state: SplitBillState): number {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return 0;
  const assigned = state.participants.reduce((sum, p) => {
    const a = p.assignments.find((a) => a.itemId === itemId);
    return sum + (a?.qty ?? 0);
  }, 0);
  return item.qty - assigned;
}

export function hasUnassignedItems(state: SplitBillState): boolean {
  return state.items.some((item) => getRemainingQty(item.id, state) > 0);
}

// Context
interface SplitBillContextValue {
  state: SplitBillState;
  dispatch: React.Dispatch<Action>;
}

const SplitBillContext = createContext<SplitBillContextValue | null>(null);

export function SplitBillProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  return (
    <SplitBillContext.Provider value={{ state, dispatch }}>
      {children}
    </SplitBillContext.Provider>
  );
}

export function useSplitBill() {
  const ctx = useContext(SplitBillContext);
  if (!ctx) throw new Error("useSplitBill must be used within SplitBillProvider");
  return ctx;
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/components/split-bill/split-bill-context.tsx
git commit -m "feat(split-bill): add SplitBillProvider context with reducer and computed helpers"
```

---

### Task 6: Split Bill Layout & Route Setup

**Files:**
- Create: `src/app/split-bill/new/layout.tsx`
- Create: `src/app/split-bill/new/page.tsx` (redirect to /items)
- Create: `src/app/split-bill/new/items/page.tsx` (placeholder)
- Create: `src/app/split-bill/new/split/page.tsx` (placeholder)
- Create: `src/app/split-bill/new/preview/page.tsx` (placeholder)
- Create: `src/components/split-bill/SplitBillStepper.tsx`

**Step 1: Create shared stepper component**

`src/components/split-bill/SplitBillStepper.tsx`:

```typescript
"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = [
  { path: "/split-bill/new/items", label: "Item" },
  { path: "/split-bill/new/split", label: "Bagi" },
  { path: "/split-bill/new/preview", label: "Ringkasan" },
];

export function SplitBillStepper() {
  const pathname = usePathname();
  const currentIndex = steps.findIndex((s) => pathname.startsWith(s.path));

  return (
    <div className="flex items-center justify-center gap-2 px-5 py-3">
      {steps.map((step, i) => (
        <div key={step.path} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                i <= currentIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                i <= currentIndex ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-6",
                i < currentIndex ? "bg-primary" : "bg-muted",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create layout with provider**

`src/app/split-bill/new/layout.tsx`:

```typescript
import { SplitBillProvider } from "@/components/split-bill/split-bill-context";
import { SplitBillStepper } from "@/components/split-bill/SplitBillStepper";

export default function SplitBillLayout({ children }: { children: React.ReactNode }) {
  return (
    <SplitBillProvider>
      <div className="flex min-h-screen flex-col">
        <SplitBillStepper />
        <div className="flex-1">{children}</div>
      </div>
    </SplitBillProvider>
  );
}
```

**Step 3: Create redirect page**

`src/app/split-bill/new/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function SplitBillNewPage() {
  redirect("/split-bill/new/items");
}
```

**Step 4: Create placeholder pages**

`src/app/split-bill/new/items/page.tsx`:

```typescript
export default function ItemsPage() {
  return <div className="p-5">Items page (placeholder)</div>;
}
```

`src/app/split-bill/new/split/page.tsx`:

```typescript
export default function SplitPage() {
  return <div className="p-5">Split page (placeholder)</div>;
}
```

`src/app/split-bill/new/preview/page.tsx`:

```typescript
export default function PreviewPage() {
  return <div className="p-5">Preview page (placeholder)</div>;
}
```

**Step 5: Run typecheck and verify dev server**

```bash
pnpm typecheck
```

**Step 6: Commit**

```bash
git add src/app/split-bill/ src/components/split-bill/SplitBillStepper.tsx
git commit -m "feat(split-bill): add route structure, layout with provider, and stepper"
```

---

### Task 7: Update InputMethodDrawer Layout

**Files:**
- Modify: `src/components/transaction/InputMethodDrawer.tsx`

**Step 1: Change to vertical list layout and add Split Bill option**

Replace the `grid grid-cols-2` div with a vertical list. Add a `Link` import from `next/link`. Add the `Scissors` icon from `lucide-react`. The Split Bill option uses `<Link>` to navigate to `/split-bill/new/items` and closes the drawer via `onOpenChange(false)`.

The 4 existing options (Manual, Scan Struk, Suara, Teks Cerdas) become horizontal rows with icon on left and label on right. The new Split Bill option is added at the bottom.

Each row: `flex items-center gap-4 rounded-2xl border p-4` with icon circle on left and label on right.

The scan dropdown stays the same but embedded in the row layout.

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/components/transaction/InputMethodDrawer.tsx
git commit -m "feat(split-bill): update InputMethodDrawer to vertical list with Split Bill option"
```

---

### Task 8: Step 1 — Bill Input Page

**Files:**
- Create: `src/components/split-bill/BillItemRow.tsx`
- Rewrite: `src/app/split-bill/new/items/page.tsx`

**Step 1: Create BillItemRow component**

`src/components/split-bill/BillItemRow.tsx` — a single item row with name input, qty input, price input, delete button, and subtotal display. Uses `useSplitBill()` context to dispatch updates.

**Step 2: Build the items page**

`src/app/split-bill/new/items/page.tsx` — full implementation:

- Header: back Link to `/dashboard`, title "Split Bill"
- AI scan button at top: "Scan Struk (AI)" with sparkle icon, dropdown for Camera/Gallery
  - Reuses the `compressImage` utility from `@/lib/image`
  - Calls `api.ai.scanReceiptItems.useMutation()`
  - On success, dispatches `SET_ITEMS_FROM_SCAN` with mapped items (add `nanoid()` for each item id)
- Hidden file inputs for camera/gallery (same pattern as `TransactionManager`)
- List of `BillItemRow` components
- "Tambah Item" button dispatching `ADD_ITEM`
- Tax and Discount inputs dispatching `SET_TAX` / `SET_DISCOUNT`
- Sticky bottom bar: subtotal, +tax, -discount, = final total
- "Lanjut" Link to `/split-bill/new/split`, disabled if no items with price > 0

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/components/split-bill/BillItemRow.tsx src/app/split-bill/new/items/page.tsx
git commit -m "feat(split-bill): implement bill input page with AI scan support"
```

---

### Task 9: Step 2 — Split Page

**Files:**
- Create: `src/components/split-bill/ParticipantBar.tsx`
- Create: `src/components/split-bill/SplitItemRow.tsx`
- Rewrite: `src/app/split-bill/new/split/page.tsx`

**Step 1: Create ParticipantBar component**

`src/components/split-bill/ParticipantBar.tsx` — horizontal scrolling bar:
- "+" button to add participant (dispatches `ADD_PARTICIPANT`)
- Circle avatars for each participant showing first letter of name
- Active participant has highlighted ring (primary border)
- Tap to select (sets local `activeParticipantId` state)
- Tap name to edit inline (input replaces label, dispatches `UPDATE_PARTICIPANT_NAME`)
- Long press on non-owner shows delete (dispatches `REMOVE_PARTICIPANT`)

**Step 2: Create SplitItemRow component**

`src/components/split-bill/SplitItemRow.tsx` — a row showing:
- Item name, total qty, price per unit, subtotal (read-only)
- When activeParticipantId is set: qty stepper (-, number, +)
- Stepper uses `getRemainingQty()` to cap the maximum
- Dispatches `SET_ASSIGNMENT` on change
- Visual highlight when active participant has qty > 0

**Step 3: Build the split page**

`src/app/split-bill/new/split/page.tsx`:
- Header: back Link to `/split-bill/new/items`, title "Bagi Tagihan"
- `ParticipantBar` at top
- Local state: `activeParticipantId`
- List of `SplitItemRow` components with `activeParticipantId` prop
- Summary section showing active participant's share via `getParticipantShare()`
- Sticky "Lanjut" Link to `/split-bill/new/preview`, disabled if `hasUnassignedItems()`
- If no context data (items empty), redirect to `/split-bill/new/items`

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

**Step 5: Commit**

```bash
git add src/components/split-bill/ParticipantBar.tsx src/components/split-bill/SplitItemRow.tsx src/app/split-bill/new/split/page.tsx
git commit -m "feat(split-bill): implement split assignment page with participant management"
```

---

### Task 10: Step 3 — Preview Page

**Files:**
- Create: `src/components/split-bill/ParticipantCard.tsx`
- Rewrite: `src/app/split-bill/new/preview/page.tsx`

**Step 1: Create ParticipantCard component**

`src/components/split-bill/ParticipantCard.tsx`:
- Card showing participant name as header
- List of their assigned items (name, qty x price = subtotal)
- Tax share, discount share
- Total line
- Primary border if `isOwner`

**Step 2: Build the preview page**

`src/app/split-bill/new/preview/page.tsx`:
- Header: back Link to `/split-bill/new/split`, title "Ringkasan"
- List of `ParticipantCard` components (owner first)
- Grand total bar
- "Simpan & Bagikan" button:
  - Calls `api.splitBill.create.useMutation()`
  - Maps context state to the mutation input format
  - `title` = first item name or "Split Bill"
  - On success: use `router.push(`/split-bill/${result.id}`)` (this is a post-mutation redirect, not navigation Link)
  - Dispatches `RESET` on success
- If no context data, redirect to `/split-bill/new/items`
- Uses `useActiveWorkspace()` for `workspaceId`

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/components/split-bill/ParticipantCard.tsx src/app/split-bill/new/preview/page.tsx
git commit -m "feat(split-bill): implement preview page with save and share"
```

---

### Task 11: Result Page (Authenticated)

**Files:**
- Create: `src/app/split-bill/[id]/page.tsx`

**Step 1: Build the result page**

`src/app/split-bill/[id]/page.tsx`:
- Fetches data via `api.splitBill.getById.useQuery({ id: params.id })`
- Reuses `ParticipantCard` for each participant
- Share banner showing the share URL: `${window.location.origin}/s/${data.shareCode}`
- Share button: tries `navigator.share()`, falls back to clipboard copy with toast
- "Tambah ke transaksi?" button:
  - Opens a small drawer/dialog to select wallet (and optionally category)
  - Calls `api.splitBill.addToTransaction.useMutation()`
  - On success: shows confirmation, button changes to "Sudah ditambahkan"
  - Disabled if `data.transactionId` already exists
- Back Link to `/dashboard`

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add src/app/split-bill/\[id\]/page.tsx
git commit -m "feat(split-bill): implement result page with share and add-to-transaction"
```

---

### Task 12: Public Share Page

**Files:**
- Create: `src/app/s/[code]/page.tsx`
- Modify: `src/middleware.ts`

**Step 1: Update middleware to exclude /s/ routes**

In `src/middleware.ts`, add `/s/` path to the public routes or to the matcher exclusion.

The simplest approach: add `"/s"` prefix check to the `publicRoutes` logic:

```typescript
const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname)
  || request.nextUrl.pathname.startsWith("/s/");
```

**Step 2: Build the public share page**

`src/app/s/[code]/page.tsx`:
- This can be a Server Component that fetches data via `createCaller` (direct DB query, no auth needed since `getByCode` is `publicProcedure`)
- Alternatively, make it a client component using `api.splitBill.getByCode.useQuery({ code: params.code })`
- Displays: Dompetin logo, bill title, per-participant breakdown using `ParticipantCard`
- Bottom PWA install banner: "Kelola keuanganmu lebih mudah dengan Dompetin" with link to home page
- No "Add to transaction" button

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add src/app/s/ src/middleware.ts
git commit -m "feat(split-bill): add public share page and update middleware"
```

---

### Task 13: Final Integration & Polish

**Step 1: Run full check**

```bash
pnpm check
```

Fix any lint or type errors.

**Step 2: Test the full flow manually**

1. Open dashboard → tap FAB → InputMethodDrawer shows vertical list → tap "Split Bill"
2. Items page: add items manually or scan receipt → verify totals → tap Lanjut
3. Split page: add participants, assign items → verify shares → tap Lanjut
4. Preview: verify breakdown → tap "Simpan & Bagikan"
5. Result page: verify share link works, try "Add to transaction"
6. Open `/s/[code]` in incognito → verify public view shows correctly without auth

**Step 3: Final commit**

```bash
git add .
git commit -m "feat(split-bill): polish and integration fixes"
```
