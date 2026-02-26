# dompetin — Product & Business Flow Brief

**Prepared for: Lead Developer**
**Version:** 1.1 — February 2025
**Classification:** Confidential & Internal Use Only

---

## Tech Stack

| Layer          | Technology           |
| -------------- | -------------------- |
| Framework      | Next.js (App Router) |
| API            | tRPC                 |
| Authentication | BetterAuth           |
| ORM / Database | Drizzle ORM          |
| Styling        | Tailwind CSS         |
| UI Components  | shadcn/ui            |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Architecture](#2-core-architecture)
3. [User Flows](#3-user-flows)
4. [Transaction Flows](#4-transaction-flows)
5. [Budget Flow](#5-budget-flow)
6. [Savings Goals Flow](#6-savings-goals-flow)
7. [Analytics & Reporting](#7-analytics--reporting)
8. [Notification Triggers](#8-notification-triggers)
9. [Drizzle Schema Reference](#9-drizzle-schema-reference)
10. [tRPC Router Structure](#10-trpc-router-structure)
11. [BetterAuth Integration](#11-betterauth-integration)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Out of Scope — v1](#13-out-of-scope--version-1)
14. [Open Questions](#14-open-questions-for-development-team)

---

## 1. Executive Summary

Dompetin is a modern personal finance web application designed specifically for Indonesian users. The product is built around two foundational systems that differentiate it from generic expense trackers: the **Workspace System** and the **Wallet System**. Together, these systems allow a single user to manage completely separate financial contexts (Personal, Family, Business) while maintaining a clear, wallet-level transaction structure within each context.

This brief defines the business flows that the development team must implement. All flows described here are the source of truth for tRPC procedure design, Drizzle schema decisions, and data architecture. The UI prototype developed in parallel is a reference for interaction patterns only; this document governs the business rules.

> **Product Positioning**
>
> - Target market: Indonesian users, 18–40 years old, multi-income or family financial management needs.
> - Primary differentiation: Workspace isolation with per-workspace insights, and wallet-centric transaction tracking.
> - Default currency: Indonesian Rupiah (IDR). Multi-currency not in scope for v1.
> - Platform: Web application built with Next.js. Mobile PWA support is a stretch goal for v1.

---

## 2. Core Architecture

The entire application is structured around a two-level hierarchy. Every piece of financial data in Dompetin belongs to a **Workspace**, and every transaction belongs to a **Wallet** within that Workspace. There are no exceptions to this rule.

### 2.1 Data Hierarchy

| Level | Entity        | Scope         | Isolation                                                        |
| ----- | ------------- | ------------- | ---------------------------------------------------------------- |
| 1     | User Account  | Global        | Managed by BetterAuth. Shared across all workspaces.             |
| 2     | Workspace     | Per user      | Completely isolated: wallets, transactions, budgets, goals       |
| 3     | Wallet        | Per workspace | All transactions must reference a wallet. Balances are computed. |
| 4     | Transaction   | Per wallet    | Atomic unit: Income, Expense, or Transfer between wallets.       |
| 5     | Budget / Goal | Per workspace | Supporting financial management objects scoped to a workspace.   |

### 2.2 Workspace System

The Workspace is the primary innovation in Dompetin. A user can create multiple workspaces, each representing a distinct financial context. The core principle is **complete data isolation**: a transaction in the "Keluarga" (Family) workspace is never visible, aggregated with, or affecting balances in the "Pribadi" (Personal) workspace.

- Each workspace has an **Owner** (the creator) and optionally one or more **Members**.
- Members are invited via email and can be assigned view-only or full-edit roles (v1 can simplify to Owner / Member with edit rights).
- A user can belong to multiple workspaces in different roles.
- The active workspace is stored in a session cookie or React context and determines all data returned by tRPC queries.
- Switching workspaces triggers a full tRPC cache invalidation for workspace-scoped queries via `utils.invalidate()`.

> **Business Rule — Workspace Isolation**
>
> - No cross-workspace transactions are permitted in v1.
> - Workspace-level totals (balance, income, expense) must never aggregate across workspaces.
> - Deleting a workspace cascades to all wallets, transactions, budgets, and goals within it. This action is irreversible and requires explicit confirmation.
> - A user's default Personal workspace (created at onboarding) cannot be deleted, only renamed.
> - Every tRPC procedure that accesses financial data must validate workspace membership server-side via a shared `workspaceGuard` middleware. Never trust the client-supplied `workspaceId` alone.

### 2.3 Wallet System

Within each workspace, the user manages one or more **Wallets**. A Wallet represents a real-world money container: physical cash, a bank account, an e-wallet like GoPay or Dana, a savings account, or a business account. Every single transaction must be associated with a Wallet.

| Wallet Type      | Description                               | Notes                                  |
| ---------------- | ----------------------------------------- | -------------------------------------- |
| Cash             | Physical cash held by the user            | Most common first wallet at onboarding |
| Bank Account     | Manually tracked bank account             | No live bank sync in v1                |
| E-Wallet         | GoPay, OVO, Dana, ShopeePay, etc.         | Manually tracked                       |
| Savings          | Dedicated savings pool within a workspace | Can be goal-linked in v2               |
| Business Account | Typically in a Business workspace         | Same mechanics as Bank Account         |
| Custom           | User-defined type and label               | Free text `type` field                 |

> **Business Rule — Wallet Balance**
>
> - Initial balance is set by the user when creating the wallet. Stored as a field on the wallet row; treated as a baseline offset in balance computation.
> - Balance is always computed as: `initialBalance + Σ(income transactions) − Σ(expense transactions) ± Σ(transfer transactions)`.
> - Balance is **never stored as a mutable field** — it must be computed via a Drizzle aggregation query to ensure ledger consistency.
> - A wallet balance can go negative. The app displays a warning but does not block the transaction.

---

## 3. User Flows

### 3.1 Onboarding & Account Creation

A new user goes through a single onboarding flow that creates their account, establishes their default Personal workspace, and optionally sets up their first wallet. This flow runs once.

| Step | Name                       | Description                                                                                                                                                                                            |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Onboarding Slides          | User views 3 informational slides. No data collected. Slides can be skipped. Rendered as a client component with local state.                                                                          |
| 2    | Account Registration       | User enters: Full Name, Email, Password (min 8 characters). BetterAuth handles credential hashing, session creation, and the auth cookie.                                                              |
| 3    | Default Workspace Creation | After successful registration, a `workspace.create` tRPC mutation is called server-side (in the BetterAuth `onAfterSignUp` hook or equivalent) to create a "Pribadi" workspace with the user as Owner. |
| 4    | First Wallet Setup         | App prompts the user to create their first wallet (name, type, initial balance). Calls `wallet.create`. This step can be skipped.                                                                      |
| 5    | Land on Dashboard          | User is redirected to `/dashboard`. The active workspace ID is set in the session. All tRPC queries on this page are scoped to this workspace.                                                         |

### 3.2 Workspace Management Flow

| Step | Name                               | Description                                                                                                                                                                                                              |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Open Workspace Manager             | User clicks the workspace selector pill on the Dashboard. The Workspace Management page/modal opens, populated by `workspace.list` query.                                                                                |
| 2    | Switch Active Workspace            | User selects a workspace. The active `workspaceId` is updated in a session cookie or Zustand store. tRPC query cache is invalidated via `utils.workspace.invalidate()`. All queries refetch scoped to the new workspace. |
| 3    | Create New Workspace               | `workspace.create` mutation. Input: name, optional icon. System creates the workspace and inserts the owner row into `workspace_members`.                                                                                |
| 4    | Invite Member                      | `workspace.invite` mutation. Input: email address. System sends an invitation email via the email provider configured in BetterAuth. Invitee accepts via a signed URL.                                                   |
| 5    | Remove Member / Transfer Ownership | `workspace.removeMember` and `workspace.transferOwnership` mutations. Ownership transfer demotes original owner to Member.                                                                                               |

### 3.3 Wallet Management Flow

| Step | Name               | Description                                                                                                                                                                |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | View Wallets       | `wallet.list` query scoped to `workspaceId`. Returns all wallets with their computed balance (aggregated in the query, not a stored field).                                |
| 2    | Create Wallet      | `wallet.create` mutation. Input: name (required), type (required), initialBalance (default 0).                                                                             |
| 3    | View Wallet Detail | `wallet.getById` query. Returns wallet metadata + computed balance + current month income/expense summary. Transactions fetched separately via `transaction.listByWallet`. |
| 4    | Edit Wallet        | `wallet.update` mutation. Name and type only. Initial balance adjustments are recorded as corrective transactions, not direct field edits, to preserve ledger integrity.   |
| 5    | Delete Wallet      | `wallet.delete` mutation. Blocked server-side if wallet has any transaction records. If confirmed by user with explicit acknowledgment, performs a cascade soft-delete.    |

---

## 4. Transaction Flows

Transactions are the atomic unit of the entire system. All balance computations, budget tracking, and goal progress derive from the transaction ledger.

### 4.1 Income Transaction

An Income transaction increases the balance of the selected wallet.

| Step | Name                   | Description                                                                                                                                                      |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Open Add Transaction   | User clicks the FAB (+) button. A shadcn/ui Sheet or Dialog opens. Default type is "Pengeluaran".                                                                |
| 2    | Select Type: Pemasukan | User selects the Income tab. The category dropdown updates to income-specific options.                                                                           |
| 3    | Enter Amount           | Positive integer in IDR. Validated with Zod: `z.number().int().positive()`. No decimals.                                                                         |
| 4    | Select Wallet          | Dropdown populated by `wallet.list` for the active workspace. Required.                                                                                          |
| 5    | Select Category        | Enum: `gaji`, `freelance`, `bisnis`, `investasi`, `hadiah`, `lainnya`. Required.                                                                                 |
| 6    | Set Date               | Defaults to today. Past dates only — future dates rejected in Zod schema: `z.date().max(new Date())`.                                                            |
| 7    | Add Note (optional)    | Free text. `z.string().max(255).optional()`.                                                                                                                     |
| 8    | Save                   | `transaction.create` mutation. On success, invalidates `wallet.list`, `transaction.list`, and `analytics.summary` queries. Shows a shadcn/ui `toast` on success. |

### 4.2 Expense Transaction

An Expense transaction decreases the balance of the selected wallet. Flow is identical to Income with these differences:

- Type stored as `expense` in the `type` enum column.
- Wallet balance is reduced by the transaction amount.
- Category enum: `makanan`, `transportasi`, `belanja`, `hiburan`, `tagihan`, `kesehatan`, `pendidikan`, `lainnya`.
- If the resulting computed balance would be negative, the server returns a warning flag in the mutation response. The client displays a shadcn/ui `Alert` but proceeds to save.

### 4.3 Transfer Transaction

A Transfer moves balance between two wallets within the same workspace. It creates **two linked transaction records** — one debit, one credit — sharing a `transferId`.

| Step | Name                      | Description                                                                                                                                                                                                                  |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Select Type: Transfer     | User selects Transfer tab. Wallet selector splits into two dropdowns: "Dari Dompet" and "Ke Dompet".                                                                                                                         |
| 2    | Select Source Wallet      | Dropdown from `wallet.list`. Displays computed balance as helper text.                                                                                                                                                       |
| 3    | Select Destination Wallet | Same list, same workspace. Server rejects if `fromWalletId === toWalletId`.                                                                                                                                                  |
| 4    | Enter Amount              | Single amount. Same value debited from source and credited to destination.                                                                                                                                                   |
| 5    | Set Date and Note         | Same rules as Income/Expense.                                                                                                                                                                                                |
| 6    | Save                      | `transaction.createTransfer` mutation. Runs inside a Drizzle transaction (`db.transaction()`): inserts both records atomically. If either insert fails, both are rolled back. Both records share the same `transferId` UUID. |

> **Business Rule — Transfer Integrity**
>
> - A Transfer always creates exactly 2 transaction records. There is no single-record transfer.
> - Source and destination wallets must both belong to the active workspace. Enforced in the tRPC procedure before the DB write.
> - `transaction.delete` checks if the target record has a `transferId`. If so, both linked records are deleted together in one Drizzle transaction.
> - `transaction.update` on a transfer must update both records simultaneously in one Drizzle transaction.

---

## 5. Budget Flow

Budgets are set per expense category, per workspace, per calendar month. They track real-time spending progress against a defined limit.

| Step | Name                 | Description                                                                                                                                                                                               |
| ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Create Budget        | `budget.create` mutation. Input: category (enum), limitAmount, month (YYYY-MM string). One budget per category per month per workspace — enforced via a unique index on `(workspaceId, category, month)`. |
| 2    | Real-Time Tracking   | Budget progress is not stored. It is computed on read: `budget.listWithProgress` query joins budgets with the sum of expense transactions for the matching category and month.                            |
| 3    | Warning Threshold    | Client-side: when `spentAmount / limitAmount >= 0.8`, render the progress bar in amber. No server flag needed.                                                                                            |
| 4    | Over-Budget State    | Client-side: when `spentAmount > limitAmount`, render the progress bar in red. The `budget.listWithProgress` query also returns an `isOverBudget` boolean for convenience.                                |
| 5    | Monthly Rollover     | A Next.js cron route (`/api/cron/budget-rollover`) runs on the 1st of each month. It reads all active budgets from the previous month and inserts copies for the new month. Protected by a secret header. |
| 6    | Edit / Delete Budget | `budget.update` (limitAmount only) and `budget.delete` mutations. Deletion does not affect any transactions.                                                                                              |

> **Business Rule — Budget Scope**
>
> - Budget tracking only applies to **Expense** transactions. Income and Transfer do not affect budget progress.
> - Budget category must match the transaction expense category enum exactly.
> - Budgets are workspace-scoped. The `workspaceGuard` middleware enforces this on all budget procedures.

---

## 6. Savings Goals Flow

Goals allow users to define savings targets and manually track contributions toward them.

| Step | Name               | Description                                                                                                                                                                                                                                             |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Create Goal        | `goal.create` mutation. Input: name, targetAmount, optional targetDate. Created with `currentAmount = 0`.                                                                                                                                               |
| 2    | Contribute to Goal | `goal.contribute` mutation. Input: amount, sourceWalletId. Atomically: (1) creates an Expense transaction on the source wallet (category: `tabungan`), (2) increments `goal.currentAmount` by the same amount. Both writes in one Drizzle transaction.  |
| 3    | Progress Tracking  | `goal.currentAmount / goal.targetAmount` as a percentage. Computed on read; no separate field needed.                                                                                                                                                   |
| 4    | Goal Completed     | Server sets `goal.status = 'achieved'` when `currentAmount >= targetAmount` after a contribution. Client renders a completion state.                                                                                                                    |
| 5    | Withdraw from Goal | `goal.withdraw` mutation. Input: amount, destinationWalletId. Atomically: (1) creates an Income transaction on the destination wallet (category: `penarikan_tabungan`), (2) decrements `goal.currentAmount`. Blocked if amount exceeds `currentAmount`. |

---

## 7. Analytics & Reporting

Analytics are always scoped to the **active workspace**. All aggregation happens in Drizzle queries on the server — no raw number crunching on the client.

### 7.1 Dashboard Summary

Served by the `analytics.summary` tRPC query. Returns:

- **totalBalance** — `SUM(initialBalance) + SUM(income) − SUM(expense)` across all wallets in the workspace. Computed via a single SQL aggregation.
- **monthlyIncome** — `SUM(amount)` where `type = 'income'` and `date` is within the current calendar month.
- **monthlyExpense** — `SUM(amount)` where `type = 'expense'` and `date` is within the current calendar month.
- **recentTransactions** — Last 10 transactions across all wallets, ordered by `date DESC`, joined with wallet name.

### 7.2 Trend Chart

Served by the `analytics.trends` tRPC query. Input: `period: z.enum(['daily', 'monthly', 'yearly'])`.

- **daily** — Net balance per day for the last 7 days.
- **monthly** — Net balance per month for the last 6 months.
- **yearly** — Net balance per year for the last 5 years.

Data is grouped and aggregated in Drizzle using `sql` template literals. Returned as an array of `{ label: string, value: number }` objects. The chart is rendered client-side using Recharts (recommended with shadcn/ui chart primitives).

### 7.3 Wallet-Level Analytics

Served by `analytics.walletSummary`. Input: `walletId`. Returns:

- Monthly income and expense for the wallet.
- Transaction list filtered by `walletId` (paginated, 20 per page).

### 7.4 Period Filtering

The period filter (Harian / Bulanan / Tahunan) applies to the **trend chart query only**. The income/expense summary cards always show current calendar month totals regardless of the selected period.

---

## 8. Notification Triggers

In v1, notifications are **in-app only** (no push notifications). They are surfaced as shadcn/ui `Toast` messages or persistent `Alert` banners.

| Event            | Trigger                                                | Delivery                        | Message (example)                                  |
| ---------------- | ------------------------------------------------------ | ------------------------------- | -------------------------------------------------- |
| Budget Warning   | `spentAmount / limitAmount >= 0.8` on any expense save | Toast on transaction save       | "Anggaran Makanan hampir habis — 80% terpakai"     |
| Budget Exceeded  | `spentAmount > limitAmount` on any expense save        | Persistent Alert on Budget page | "Anggaran Belanja terlampaui bulan ini"            |
| Goal Achieved    | `currentAmount >= targetAmount` on contribution        | Toast on contribution save      | "Selamat! Tujuan Dana Darurat tercapai"            |
| Negative Balance | Computed balance < 0 after an expense                  | Warning on transaction form     | "Saldo tidak cukup, transaksi tetap bisa disimpan" |

> Push notifications (FCM) are deferred to v2 once the product is stable.

---

## 9. Drizzle Schema Reference

A business-level field map to guide schema design. All tables use `cuid2` or `uuid` for primary keys. Use `pgTable` for PostgreSQL (recommended) or `sqliteTable` for SQLite.

```ts
// users — managed by BetterAuth, do not create manually.
// BetterAuth generates its own users table. Reference it by userId foreign key.

// workspaces
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull(), // FK → users.id
  isDefault: boolean("is_default").default(false), // true for the Pribadi workspace
  createdAt: timestamp("created_at").defaultNow(),
});

// workspace_members
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id").notNull(), // FK → workspaces.id
    userId: text("user_id").notNull(), // FK → users.id
    role: text("role", { enum: ["owner", "member"] }).notNull(),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.userId] }),
  }),
);

// wallets
export const wallets = pgTable("wallets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(), // FK → workspaces.id
  name: text("name").notNull(),
  type: text("type").notNull(), // 'cash' | 'bank' | 'ewallet' | 'savings' | 'business' | 'custom'
  initialBalance: integer("initial_balance").default(0), // IDR, stored as integer
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // soft delete
});

// transactions
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(), // FK → workspaces.id (denormalized for query performance)
  walletId: text("wallet_id").notNull(), // FK → wallets.id
  type: text("type", {
    enum: ["income", "expense", "transfer_debit", "transfer_credit"],
  }).notNull(),
  amount: integer("amount").notNull(), // IDR, always positive integer
  category: text("category").notNull(),
  date: date("date").notNull(),
  note: text("note"),
  transferId: text("transfer_id"), // shared UUID linking the debit+credit pair
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // soft delete
});

// budgets
export const budgets = pgTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(), // FK → workspaces.id
    category: text("category").notNull(), // must match transaction expense category enum
    limitAmount: integer("limit_amount").notNull(), // IDR
    month: text("month").notNull(), // format: 'YYYY-MM'
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex("budget_unique").on(t.workspaceId, t.category, t.month),
  }),
);

// goals
export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(), // FK → workspaces.id
  name: text("name").notNull(),
  targetAmount: integer("target_amount").notNull(),
  currentAmount: integer("current_amount").default(0),
  targetDate: date("target_date"),
  status: text("status", { enum: ["active", "achieved"] }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

> **Key schema decisions**
>
> - Transfer types split into `transfer_debit` and `transfer_credit` rather than a single `transfer` type — this simplifies balance computation (debit = subtract, credit = add, mirrors expense/income semantics).
> - `workspaceId` is denormalized onto `transactions` to avoid joining through `wallets` on every analytics query.
> - All financial amounts are stored as **integers in IDR**. No `decimal` or `float` types anywhere.
> - Soft deletes (`deletedAt`) on wallets and transactions. All Drizzle queries must include `isNull(table.deletedAt)` in their `where` clause.

---

## 10. tRPC Router Structure

All procedures use the `protectedProcedure` base (requires active BetterAuth session). Workspace-scoped procedures additionally run through a `workspaceProcedure` middleware that validates membership before any DB access.

```
src/server/api/
├── root.ts                     ← AppRouter combining all routers
├── trpc.ts                     ← createTRPCRouter, protectedProcedure, workspaceProcedure
└── routers/
    ├── workspace.router.ts
    │   ├── list                ← query   — all workspaces the user belongs to
    │   ├── create              ← mutation
    │   ├── update              ← mutation (name only)
    │   ├── delete              ← mutation (blocked if isDefault = true)
    │   ├── invite              ← mutation
    │   ├── removeMember        ← mutation
    │   └── transferOwnership   ← mutation
    │
    ├── wallet.router.ts
    │   ├── list                ← query   (workspaceId) → wallets + computed balance
    │   ├── getById             ← query   → wallet + balance + monthly summary
    │   ├── create              ← mutation
    │   ├── update              ← mutation
    │   └── delete              ← mutation
    │
    ├── transaction.router.ts
    │   ├── listByWallet        ← query   (walletId, pagination)
    │   ├── listByWorkspace     ← query   (workspaceId, filters, pagination)
    │   ├── create              ← mutation (income | expense)
    │   ├── createTransfer      ← mutation (runs in db.transaction())
    │   ├── update              ← mutation (handles transfer pair update atomically)
    │   └── delete              ← mutation (handles transfer pair deletion atomically)
    │
    ├── budget.router.ts
    │   ├── listWithProgress    ← query   (workspaceId, month) → budgets + computed spent + isOverBudget
    │   ├── create              ← mutation
    │   ├── update              ← mutation (limitAmount only)
    │   └── delete              ← mutation
    │
    ├── goal.router.ts
    │   ├── list                ← query   (workspaceId)
    │   ├── create              ← mutation
    │   ├── update              ← mutation
    │   ├── contribute          ← mutation (runs in db.transaction())
    │   └── withdraw            ← mutation (runs in db.transaction())
    │
    └── analytics.router.ts
        ├── summary             ← query   (workspaceId) → totalBalance, monthlyIncome, monthlyExpense, recentTransactions
        └── trends              ← query   (workspaceId, period: 'daily' | 'monthly' | 'yearly')
```

### Workspace Guard Middleware

Every procedure that accepts a `workspaceId` must validate membership before touching the database:

```ts
// src/server/api/trpc.ts
const workspaceProcedure = protectedProcedure.use(
  async ({ ctx, input, next }) => {
    const { workspaceId } = input as { workspaceId: string };
    const member = await ctx.db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, ctx.session.user.id),
      ),
    });
    if (!member) throw new TRPCError({ code: "FORBIDDEN" });
    return next({ ctx: { ...ctx, workspaceMember: member } });
  },
);
```

---

## 11. BetterAuth Integration

BetterAuth handles all authentication concerns. The following describes how it integrates with the Dompetin data model.

### Setup

```ts
// src/server/auth.ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 7 }, // 7 days
  },
});
```

### Post-Registration Hook

After a user registers, create their default "Pribadi" workspace:

```ts
// Triggered inside BetterAuth's onAfterSignUp callback
async function onAfterSignUp(userId: string) {
  const workspaceId = createId();
  await db.insert(workspaces).values({
    id: workspaceId,
    name: "Pribadi",
    ownerUserId: userId,
    isDefault: true,
  });
  await db.insert(workspaceMembers).values({
    workspaceId,
    userId,
    role: "owner",
  });
}
```

### Session Extension

Extend the BetterAuth session to carry the `activeWorkspaceId` so tRPC procedures can access it without an extra round-trip:

```ts
declare module "better-auth" {
  interface Session {
    activeWorkspaceId: string;
  }
}
```

### Route Protection

Use BetterAuth's `auth.api.getSession()` in Next.js middleware to protect all `/dashboard/*` routes:

```ts
// middleware.ts
export async function middleware(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
```

---

## 12. Non-Functional Requirements

| Category        | Requirement                                                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Performance     | Workspace context switch (tRPC cache invalidation + refetch) must complete within 500ms. Dashboard initial server render (RSC) must be under 1.5 seconds. Use Next.js `loading.tsx` with Suspense boundaries on all data-heavy pages.                                             |
| Security        | All tRPC procedures use `protectedProcedure`. Workspace-scoped procedures use `workspaceProcedure` middleware (§10). Never trust a client-supplied `workspaceId` without server-side membership validation.                                                                       |
| Data Integrity  | Transfer transactions use Drizzle's `db.transaction()` for atomicity. Goal contributions and withdrawals also use `db.transaction()`. Wallet balance is always computed from the ledger — never read from a mutable stored field.                                                 |
| Currency        | All amounts stored as **integers in IDR**. No `float` or `decimal` types in the Drizzle schema. Display format: `Rp` prefix, period as thousands separator (`Rp 1.000.000`). Use a shared `formatIDR(amount: number): string` utility across all components.                      |
| Localization    | v1: Indonesian language (Bahasa Indonesia) only. Date display format: `DD MMM YYYY`. Use `date-fns/id` locale for all date formatting.                                                                                                                                            |
| Error Handling  | All tRPC mutations throw `TRPCError` with appropriate codes (`FORBIDDEN`, `BAD_REQUEST`, `NOT_FOUND`). The client uses `onError` in tRPC hooks to show shadcn/ui `Toast` messages. Form validation uses Zod schemas shared between client and server under `src/lib/validators/`. |
| Soft Deletes    | Wallets and transactions use soft deletes (`deletedAt` timestamp field). All Drizzle queries must include `isNull(table.deletedAt)` in the `where` clause. Use a shared helper or Drizzle query extension to enforce this consistently.                                           |
| Analytics Scope | All analytics queries must enforce `workspaceId` scoping at the **SQL query level** via Drizzle `where` clauses. Never filter workspace data in application-layer code after a broad fetch.                                                                                       |

---

## 13. Out of Scope — Version 1

The following features are explicitly deferred:

- Live bank account sync or open banking API integration
- Multi-currency support and exchange rate conversion
- Cross-workspace transaction linking or transfers
- Recurring transactions
- Subscription tracking
- Debt tracking
- Export to PDF or Excel
- Push notifications (FCM) — in-app toasts only in v1
- AI-based spending insights or anomaly detection
- Social features or expense splitting between users
- Mobile native app (iOS/Android) — web/PWA only in v1

---

## 14. Open Questions for Development Team

1. **Balance computation strategy:** Compute balance live in every `wallet.list` query via SQL aggregation, or maintain a cached `balance` field on the wallet row updated on every transaction write? **Recommendation:** live SQL aggregation for v1 (simpler, no risk of drift). Re-evaluate at scale.

2. **Active workspace storage:** Store `activeWorkspaceId` in the BetterAuth session (server-authoritative) or in Zustand + localStorage (faster client-side switching)? **Recommendation:** Zustand + localStorage for instant UI switching, with the session as the source of truth on first load.

3. **Workspace invitation flow:** Email-based invite with a signed URL (simpler) or shareable invite codes (more flexible)? **Recommendation:** signed URL for v1 using BetterAuth's email plugin.

4. **Soft delete filtering:** Confirm the team is aligned on adding `isNull(deletedAt)` to every Drizzle query from day one. Consider a Drizzle `.$dynamic()` extension or a shared `withoutDeleted(query)` helper to prevent accidental omission.

5. **Concurrent workspace edits:** If two members of the same workspace submit transactions simultaneously, last-write-wins is acceptable for v1. No optimistic locking needed at this stage.

---

_dompetin — Internal Product Brief — v1.1 — February 2025_
