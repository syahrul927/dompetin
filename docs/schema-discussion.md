# Schema Discussion - Frontend & Backend Alignment

**Date:** 2026-02-22
**Participants:** Frontend Lead (Claude), Backend Team

---

## Purpose

This discussion is to align on the **database schema design** for Dompetin's financial management system. The Frontend team has completed a comprehensive UI/UX implementation, and now we need to define the underlying data structure that will drive these features.

---

## Part 1: What We Built (Frontend Summary)

### Completed UI Features
1. **Authentication Flow** — Login/Register pages (auth disabled for now)
2. **Dashboard** — Balance hero, summary cards, wallet scroll, trend chart, recent transactions
3. **Add Transaction** — Bottom sheet with Drawer (vaul) for proper nesting, supports:
   - Income/Expense/Transfer types
   - Amount input with IDR formatting
   - Wallet and category pickers
   - Date selection and notes
4. **Wallets Management** — List and detail pages:
   - WalletListItem with type-specific icons (Banknote, Building2, Smartphone, PiggyBank, etc.)
   - WalletBalanceCard with gradient background
   - WalletActions (Transfer + Edit buttons)
   - WalletMonthlySummary (income vs expense with Progress bars)
   - WalletTransactionList (paginated, 20 per page)
5. **Workspace Management** — Full implementation:
   - WorkspaceListItem with role badges (Pemilik/Anggota)
   - MemberList with avatars and owner crown icon
   - CreateWorkspaceDrawer with emoji icon picker
   - InviteMemberDrawer with email input

### Current Data State
- **All using mock data** — 3 workspaces, 4 wallets, 10 transactions, 1 member
- **No real database connectivity** — tRPC calls return mock data
- **All TypeScript passing** — Zero errors across all components

---

## Part 2: Core Entities Identified

### 1. Workspaces
**Business Logic:** Multi-tenant financial management. Workspace is the primary scoping unit.

**Required Fields:**
- `id` (UUID) — Primary key
- `name` (text) — Display name
- `icon` (text) — Emoji for UI (💰, 🏠, etc.)
- `ownerId` (UUID) — References user table
- `createdAt`, `updatedAt` (timestamps)

**Questions:**
1. Should workspace switching be session-based or a separate table?
2. Should `workspace_members` be a junction table?
3. Are workspaces soft-deletable or cascade-delete only?
4. How should workspace settings (name, icon changes) be audited?

---

### 2. Wallets
**Business Logic:** Financial accounts (bank, e-wallet, cash, savings) belonging to a workspace. All transaction amounts must sum to the wallet's computed balance.

**Required Fields:**
- `id` (UUID) — Primary key
- `name` (text) — Display name
- `type` (enum) — `"tunai" | "rekening_bank" | "e_wallet" | "tabungan" | "bisnis" | "custom"`
- `balance` (computed, NOT stored) — Sum of all transactions for this wallet
- `monthlyIncome`, `monthlyExpense` (computed, optional) — For monthly summary cards
- `workspaceId` (UUID, FK) — Scoping to workspace
- `createdAt`, `updatedAt` (timestamps)

**Critical Business Rules:**
1. **Balance is computed** — Never store `balance` as a column. Calculate from `SUM(transaction.amount) WHERE transaction.walletId = ?`
2. **Initial balance handling** — Do NOT allow direct field edits. Record initial balance as a corrective transaction (type: "correction_in" or "correction_out") to preserve audit trail
3. **Soft-delete for non-empty wallets** — If wallet has transactions, set `deletedAt` instead of hard delete. Allow undelete within a period (e.g., 30 days)
4. **Wallet type icons** — Map to lucide-react icons:
   - `tunai` → `Banknote`
   - `rekening_bank` → `Building2`
   - `e_wallet` → `Smartphone`
   - `tabungan` → `PiggyBank`
   - `bisnis` → `Briefcase`
   - `custom` → `Wallet`

**Questions:**
1. How is `balance` computed? Should we cache it or calculate on every query?
2. If we cache `balance`, how do we invalidate it when transactions change?
3. Should wallet deletion be soft-delete (preserves history) or hard-delete (cascade)?
4. Should we track wallet type counts per user for dashboard display?
5. Should we support custom wallet types beyond the 6 built-in ones?

---

### 3. Transactions
**Business Logic:** The atomic unit of the entire system. All balances, budgets, and goals derive from the transaction ledger. Transactions are immutable for audit trail.

**Required Fields:**
- `id` (UUID) — Primary key
- `name` (text) — Display name
- `amount` (BigInt, positive) — Always positive, handle sign at display layer
- `type` (enum) — `"income" | "expense" | "transfer_debit" | "transfer_credit"`
- `date` (DATE) — Transaction date (not datetime for simplicity)
- `category` (enum/string) — Based on type (income vs expense categories differ)
- `notes` (text | null) — Optional free-text notes
- `walletId` (UUID, FK, optional) — For income/expense
- `fromWalletId` (UUID, FK, optional) — For `transfer_debit`
- `toWalletId` (UUID, FK, optional) — For `transfer_credit`
- `transferId` (UUID, optional) — Links transfer debit/credit records
- `workspaceId` (UUID, FK) — Scoping to workspace
- `createdAt`, `updatedAt` (timestamps)

**Critical Business Rules:**
1. **Atomic transfers** — A transfer creates EXACTLY 2 transaction records (one debit, one credit) sharing a `transferId`. Must be inserted in a DB transaction
2. **Immutable transactions** — Never allow direct updates to transaction.amount or transaction.type. If adjustment needed, create a new corrective transaction
3. **Currency handling** — Store as BigInt (cents) to avoid floating point issues. Display layer formats as IDR with thousand separators
4. **Soft-delete support** — Add `deletedAt` (nullable timestamp) for transaction and goal records. Use for "undo" functionality or audit trails
5. **Category enums** — Income and expense categories are separate enums. DO NOT use a single `category` table with a `type` discriminator

**Questions:**
1. How should we handle currency formatting (IDR)? Should it be stored in DB (as "Rp 1.000.000") or formatted on display?
2. For transfers, should we ensure atomic insert of both debit and credit records using a DB transaction?
3. Should transactions support soft-delete (archived flag) or are they immutable?
4. How do we handle pagination for transaction lists? Currently mocked at 20/page.

---

### 4. Categories
**Business Logic:** Enumerated lists of categories for transaction categorization. Income categories differ from expense categories.

**Required Data:**
```typescript
// Income categories (enum)
type IncomeCategory = "gaji" | "freelance" | "bisnis" | "investasi" | "hadiah" | "lainnya";

// Expense categories (enum)
type ExpenseCategory = "makanan" | "transportasi" | "belanja" | "hiburan" | "tagihan" | "kesehatan" | "pendidikan" | "tabungan" | "lainnya";
```

**Questions:**
1. Should categories be stored in a separate table or as a constant enum?
2. Should categories support user-defined custom categories?
3. If we add custom categories later, how do we handle migration for existing transactions?

---

### 5. Budgets
**Business Logic:** Budgets track spending limits per category, per month, per workspace. Budget progress is computed in real-time from expense transactions.

**Required Fields:**
- `id` (UUID) — Primary key
- `category` (enum/string) — Expense category from enum
- `limitAmount` (BigInt, positive) — Target spending limit
- `month` (string) — YYYY-MM format (e.g., "2025-02")
- `workspaceId` (UUID, FK) — Scoping to workspace
- `createdAt`, `updatedAt` (timestamps)

**Computed Properties (NOT stored):**
- `spentAmount` — Sum of expense transactions for that category + month
- `isOverBudget` — `spentAmount > limitAmount` (can be computed in query)
- `progressPercent` — `Math.round((spentAmount / limitAmount) * 100)` (client-side only)

**Questions:**
1. Should budget rollover be automatic (cron job) or manual?
2. Should we store `limitAmount` as decimal (for cents) or integer (whole IDR only)?
3. How do we handle budget creation for months in the past (should be prevented)?
4. Should budgets support prorated categories (different limits for each month)?

---

### 6. Goals
**Business Logic:** Financial goals with target amounts, current contributions, and completion status.

**Required Fields:**
- `id` (UUID) — Primary key
- `name` (text) — Display name
- `targetAmount` (BigInt, positive) — Target amount
- `currentAmount` (BigInt, positive) — Current contributions (≤ targetAmount)
- `isCompleted` (boolean) — `currentAmount >= targetAmount`
- `workspaceId` (UUID, FK) — Scoping to workspace
- `category` (string, optional) — Optional: what is this goal for?
- `targetDate` (Date, optional) — Optional target completion date
- `createdAt`, `updatedAt` (timestamps)

**Questions:**
1. Should goal contributions be stored as separate transaction records (linked to a goal_id)?
2. How do we handle goal completion (mark as done vs. auto-archive)?
3. Should goals support multiple contributors (shared family goals)?

---

### 7. Workspace Members (Junction Table)
**Business Logic:** Manage user membership within workspaces. Users can be owners or members with different permissions.

**Required Fields:**
- `workspaceId` (UUID, FK) — References workspace
- `userId` (UUID, FK) — References user (from Better Auth)
- `role` (enum/string) — `"owner" | "member" | "admin"`
- `joinedAt` (timestamp) — When user joined workspace

**Questions:**
1. What permissions should we support beyond owner/member?
2. Should we support workspace member roles like "admin" or "viewer"?
3. How should we handle member removal (change role vs. remove from table)?

---

## Cross-Entity Relationships

```
┌─────────────────────────────────────────────────────────┐
│                     Workspaces                             │
│                       ↓                                    │
│            ┌────────────────┐      ┌──────────────┐ │
│            │ Wallets (N)      │      │ Goals (N)   │
│            │    ↓            │      │    ↓        │
│            │ Transactions (N) │      │ Budgets (N) │
│            │                ↓    │      │            ↓        │
│            └──────────────────────┴      └─────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                                                          │
│                      Workspace_Members (Junction)                │
│                        user_id ↔ workspace_id               │
└─────────────────────────────────────────────────────────┘
```

---

## Part 3: Schema Design Decisions Required

### Decision 1: Table Naming Convention
**Proposal:** All tables use `dompetin_` prefix as configured in `drizzle.config.ts`

| Table Name | Drizzle Schema Name | Rationale |
|-------------|-------------------|----------|
| `workspace` | `dompetin_workspace` | Workspace entity |
| `wallet` | `dompetin_wallet` | Wallet entity |
| `transaction` | `dompetin_transaction` | Transaction entity |
| `category` | `dompetin_category` | Category entity |
| `budget` | `dompetin_budget` | Budget entity |
| `goal` | `dompetin_goal` | Goal entity |
| `workspace_member` | `dompetin_workspace_member` | Workspace member junction |

**Status:** ✅ Ready for implementation

---

### Decision 2: ID Type Strategy
**Proposal:** Use UUIDs (string) for all primary keys, not integers

**Rationale:**
- More secure (harder to guess IDs)
- Better for distributed systems
- Aligns with Better Auth's session management (user.id is UUID)
- Drizzle's `text("uuid")` type is efficient

**Status:** ✅ Ready for implementation

---

### Decision 3: Computed/Balanced Fields
**Proposal:** For wallet balances, do NOT store `balance` as a column. Compute on the fly from transaction ledger.

**Rationale:**
- Prevents data inconsistency (balance could diverge from transaction sum)
- Aligns with "ledger integrity" business requirement
- Single source of truth for financial data

**Implementation Options:**
1. **Cached computation** — Store computed balance and run a scheduled job to recalculate
2. **Real-time computation** — Calculate on every query from `SUM(transaction.amount)`
3. **Hybrid** — Store base balance + last transaction ID, compute delta

**Question for Backend:** Which approach do you prefer? Performance (cached) vs. Accuracy (real-time)?

---

### Decision 4: Timestamp Handling
**Proposal:** Use PostgreSQL `TIMESTAMPTZ` timezone-aware columns for `createdAt` and `updatedAt`

**Rationale:**
- Indonesia timezone (WIB) handling is critical for a financial app
- Day boundaries should be consistent for budget rollover (midnight WIB)
- Prevents timezone-related bugs in transaction dates

**Status:** ✅ Ready for implementation

---

### Decision 5: Transaction Atomicity
**Proposal:** For transfers, use a database transaction to ensure both debit and credit records are inserted atomically.

**Rationale:**
- Transfers must be complete or not at all
- If one insert fails, both should roll back
- Both records must share a `transferId` UUID for easy identification

**Implementation:** Use `await db.transaction(async (tx) => { ... })`

---

### Decision 6: Performance & Indexing
**Proposal:**
1. Implement query result caching for frequently accessed data (workspace list, wallet list)
2. Create database indexes for:
   - `transaction.workspaceId` + `transaction.date` (workspace transactions by date)
   - `transaction.walletId` (all transactions for a wallet)
   - `budget.workspaceId` + `budget.month` (budget lookup)

**Expected Data Volume:** Estimate for planning:
- 100 users × 100 transactions/month = 120K transactions/month
- 10 wallets per workspace on average
- Budget queries per category per month

**Question for Backend:** What's your expected transaction volume for MVP and scale-out?

---

### Decision 7: Validation Strategy
**Proposal:** Use Zod schemas for API input validation with business rule enforcement.

**Rationale:**
- Type safety ensures data integrity
- Server-side validation is more reliable than client-side only
- Prevents invalid data at the database layer

**Example Rules to Enforce:**
- Amount must be positive integer (no decimals for transaction amounts)
- Date cannot be in the future (`z.date().max(new Date())`)
- Wallet transfer must have different fromWalletId and toWalletId
- Negative balance warning flag for expenses (server returns warning, client displays alert but proceeds)

---

## Part 4: Architecture Questions

### Question 1: Data Scoping
How should we handle multi-tenant queries? Should we use:
- **RLS (Row Level Security):** Add a `workspaceId` WHERE clause to all queries (automatic filtering)
- **App-level filtering:** - Filter in tRPC routers based on active session (requires re-auth if workspace changes)

### Question 2: Transaction Atomicity
For transfers, should we use:
- **Database transaction** (recommended) — Atomic rollback on failure
- **Optimistic UI** (simpler code, eventual consistency)
- Or use a tRPC mutation with internal DB transaction wrapper

### Question 3: Performance
What are your performance requirements and constraints?
- Expected concurrent users?
- Database connection pool limits?
- Query timeout thresholds?

### Question 4: Migration Strategy
When real schema is ready, how should we:
- Migrate existing mock data?
- Add a data migration script?
- Require users to re-login to see new data?

---

## Part 5: Next Steps

### Phase 1: Schema Definition
**Backend Team:**
- Create complete Drizzle schema with all tables, indexes, and constraints
- Document the schema with ERD diagrams
- Define triggers if needed (e.g., budget rollover, soft-delete cleanup)

**Frontend Team:**
- Review and approve the schema
- Create TypeScript types that match the schema exactly
- Update tRPC routers to use real queries (currently mock)

---

### Phase 2: Implementation Planning
**Backend Team:**
- Implement the database migration strategy
- Create seed data script for development/testing
- Write the Drizzle migrations

**Frontend Team:**
- Replace mock data with tRPC queries
- Implement error handling and loading states
- Add optimistic updates for better UX

---

### Phase 3: Validation & Testing
**Both Teams:**
- Backend: Write unit tests for business logic (transfer atomicity, balance computation)
- Frontend: Update tests to verify correct data display
- Integration testing: Test end-to-end flows (login → dashboard → add transaction)

---

## Status

📄 **Analysis Document Created** — `docs/schema-analysis-frontend-requirements.md`
⏳ **Schema Discussion Started** — This document
❓ **Backend Feedback Pending** — Waiting for Backend team to review

---

**Frontend Lead Note to Backend Team:**

I've documented all our requirements and proposed schema design decisions. We have:

1. **Clear entity definitions** with all required fields
2. **Relationship mappings** showing how entities connect
3. **Business logic clarification** for each entity
4. **Critical decisions** that need your input (ID strategy, balance computation, atomicity, validation)

**Please review the attached requirements document and provide your feedback on:**

1. ✅ **Schema design decisions** — Do you agree with the proposals?
2. 🔧 **Technical preferences** — What's your preferred approach for computed fields, transaction atomicity, etc.?
3. ⚡ **Performance & scale** — What's your expected data volume and infrastructure constraints?
4. 📋 **Any additional business rules** we haven't captured?

Once you confirm the schema design, we can move to **Phase 2: Implementation Planning**.

---

**Ready when you are.** Let me know when the schema is ready and I'll coordinate the frontend implementation.

