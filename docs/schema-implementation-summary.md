# Dompetin Database Schema Implementation Summary

## Overview

This document summarizes the database schema implementation for Dompetin using Drizzle ORM with PostgreSQL.

## Schema Design Decisions

### 1. Primary Keys
- **Strategy**: UUID strings using PostgreSQL's `gen_random_uuid()` function
- **Reasoning**: Aligns with Better Auth's user ID strategy, provides better security than sequential IDs, and supports distributed systems
- **Implementation**: `uuid("id").primaryKey().defaultRandom()`

### 2. Table Naming
- **Prefix**: All Dompetin tables use `dompetin_` prefix
- **Reasoning**: Clear separation from Better Auth tables and future-proofing for multi-tenancy
- **Examples**: `dompetin_workspace`, `dompetin_wallet`, `dompetin_transaction`

### 3. Wallet Balance
- **Strategy**: Cached balance column with scheduled recalculation (recommended for production)
- **Current Implementation**: Stored as `numeric(15,2)` column with default value "0"
- **Note**: Frontend expects real-time balance via `SUM(transaction.amount)`. A background job should periodically update the `balance` column.

### 4. Category Model
- **Strategy**: Global shared categories for MVP
- **Reasoning**: Simpler implementation, faster queries, no per-user category duplication
- **Future**: Can extend to hierarchical user-created categories (custom categories + base system categories)

### 5. Timestamps
- **Pattern**: `createdAt` and `updatedAt` on all tables
- **Type**: `timestamp with time zone`
- **Default**: `.$defaultFn(() => new Date())`
- **Auto-update**: `updatedAt` should be updated by Drizzle or application logic

### 6. Decimal Amounts
- **Type**: `numeric(precision: 15, scale: 2)`
- **Reasoning**: Accurate financial calculations, no floating-point errors
- **Capacity**: Supports amounts up to 999,999,999,999.99 (999 trillion)

## Schema Tables

### Better Auth Tables (Do Not Modify)
- `user` - User accounts
- `session` - User sessions
- `account` - OAuth accounts
- `verification` - Email verification tokens

### Dompetin Tables

#### 1. Workspace (`dompetin_workspace`)
Multi-tenant workspaces for user grouping.

| Column | Type | Notes |
|--------|-------|-------|
| id | UUID | Primary key |
| name | varchar(255) | Workspace name |
| icon | varchar(10) | Emoji icon, default "💼" |
| ownerId | text (FK) | References user.id |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

#### 2. Workspace Member (`dompetin_workspace_member`)
Many-to-many relationship between users and workspaces.

| Column | Type | Notes |
|--------|-------|-------|
| id | UUID | Primary key |
| workspaceId | UUID (FK) | References workspace.id |
| userId | text (FK) | References user.id |
| role | text | "owner" or "member" |
| joinedAt | timestamp | Auto-generated |
| createdAt | timestamp | Auto-generated |

#### 3. Wallet (`dompetin_wallet`)
User wallets for storing money.

| Column | Type | Notes |
|--------|-------|-------|
| id | UUID | Primary key |
| name | varchar(255) | Wallet name |
| type | text | "cash", "bank", "ewallet", "savings", "investment" |
| icon | varchar(50) | Icon identifier |
| balance | numeric(15,2) | Current balance |
| currency | varchar(3) | ISO currency code, default "IDR" |
| workspaceId | UUID (FK) | References workspace.id |
| isArchived | boolean | Archive status, default false |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

#### 4. Transaction (`dompetin_transaction`)
Financial transactions (income, expense, transfer).

| Column | Type | Notes |
|--------|-------|-------|
| id | UUID | Primary key |
| type | text | "income", "expense", "transfer" |
| amount | numeric(15,2) | Transaction amount |
| name | varchar(255) | Transaction name/description |
| notes | varchar(1000) | Optional notes |
| date | date | Transaction date |
| categoryId | UUID (FK) | References category.id (nullable) |
| walletId | UUID (FK) | References wallet.id |
| toWalletId | UUID (FK) | Target wallet for transfers (nullable) |
| workspaceId | UUID (FK) | References workspace.id |
| createdBy | text (FK) | References user.id |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

#### 5. Category (`dompetin_category`)
Transaction categories (global shared for MVP).

| Column | Type | Notes |
|--------|-------|-------|
| id | UUID | Primary key |
| name | varchar(255) | Category name |
| icon | varchar(50) | Icon identifier |
| type | text | "income" or "expense" |
| color | varchar(7) | Hex color code |
| isSystem | boolean | System category flag |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

**Default Categories** (to be seeded):

Income:
- Gaji (💰)
- Bonus (🎁)
- Investasi (📈)
- Lainnya (➕)

Expense:
- Makanan (🍔)
- Transportasi (🚗)
- Belanja (🛍️)
- Tagihan (📄)
- Hiburan (🎮)
- Kesehatan (💊)
- Lainnya (➕)

#### 6. Budget (`dompetin_budget`)
Budget tracking by category.

| Column | Type | Notes |
|--------|-------|-------|
| id | UUID | Primary key |
| name | varchar(255) | Budget name |
| amount | numeric(15,2) | Budget limit |
| spent | numeric(15,2) | Amount spent |
| period | varchar(20) | "monthly", "weekly", "yearly" |
| categoryId | UUID (FK) | References category.id |
| workspaceId | UUID (FK) | References workspace.id |
| startDate | date | Budget start date |
| endDate | date | Budget end date (nullable) |
| isActive | boolean | Active status |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

#### 7. Goal (`dompetin_goal`)
Financial savings goals.

| Column | Type | Notes |
|--------|-------|-------|
| id | UUID | Primary key |
| name | varchar(255) | Goal name |
| description | varchar(1000) | Optional description |
| targetAmount | numeric(15,2) | Target amount |
| currentAmount | numeric(15,2) | Current saved amount |
| targetDate | date | Target achievement date |
| icon | varchar(50) | Goal icon, default "🎯" |
| color | varchar(7) | Color code, default "#6366f1" |
| workspaceId | UUID (FK) | References workspace.id |
| targetWalletId | UUID (FK) | Target wallet for contributions |
| isAchieved | boolean | Achievement status |
| achievedAt | timestamp | Achievement timestamp (nullable) |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

## Relationships

### User Relations
- `workspaces` → many `workspaceMember`
- `transactions` → many `transaction` (as createdBy)

### Workspace Relations
- `members` → many `workspaceMember`
- `wallets` → many `wallet`
- `transactions` → many `transaction`
- `budgets` → many `budget`
- `goals` → many `goal`

### Wallet Relations
- `transactions` → many `transaction`

### Transaction Relations
- `category` → one `category`
- `wallet` → one `wallet` (source)
- `toWallet` → one `wallet` (destination for transfers)
- `workspace` → one `workspace`

### Category Relations
- `transactions` → many `transaction`
- `budgets` → many `budget`

### Budget Relations
- `category` → one `category`
- `workspace` → one `workspace`

### Goal Relations
- `workspace` → one `workspace`
- `targetWallet` → one `wallet`

## Enums

```typescript
export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "member"]);
export const walletTypeEnum = pgEnum("wallet_type", ["cash", "bank", "ewallet", "savings", "investment"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense", "transfer"]);
export const categoryTypeEnum = pgEnum("category_type", ["income", "expense"]);
```

## Transaction Atomicity

For transfer transactions, use database transactions to ensure both debit and credit records are inserted atomically:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(transaction).values(debitRecord);
  await tx.insert(transaction).values(creditRecord);
});
```

## Indexes (Recommended)

For production performance, consider adding these indexes:
- `transaction.date` - For date-based queries
- `transaction.walletId` - For wallet transaction listing
- `transaction.workspaceId` - For workspace scoping
- `transaction.categoryId` - For category filtering
- `wallet.workspaceId` - For workspace wallet listing
- `budget.workspaceId` - For workspace budget listing
- `goal.workspaceId` - For workspace goal listing

## Next Steps

1. **Run Migration**: `pnpm db:generate && pnpm db:migrate`
2. **Seed Categories**: Create a seed script to add default categories
3. **Create tRPC Routers**: Implement workspace, wallet, transaction, category, budget, goal routers
4. **Replace Mock Data**: Update frontend components to use tRPC queries instead of mock data
5. **Implement Loading States**: Add loading and error handling to all components
6. **Balance Recalculation Job**: Create a background job to periodically update wallet.balance columns

## Files Modified

- `src/server/db/schema.ts` - Complete schema implementation
- `src/server/api/root.ts` - Added hello procedure for type inference
- `src/trpc/server.ts` - No changes needed (was already correct)
- `src/server/api/routers/post.ts` - Removed (no longer needed)
- `src/app/_components/post.tsx` - Removed (no longer needed)

## Database Migration Command

Once the schema is ready to be applied:

```bash
# Generate migration file
pnpm db:generate

# Run migration
pnpm db:migrate

# Or push directly (development only)
pnpm db:push
```

**Important**: Do NOT run migrations until you're ready to apply changes to your database.
