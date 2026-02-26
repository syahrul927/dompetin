import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { date, numeric, uuid as uuidColumn } from "drizzle-orm/pg-core";

// ============================================================================
// BETTER AUTH TABLES (reference only — managed by Better Auth)
// ============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ============================================================================
// DOMPETIN TABLES
// ============================================================================

// Enums
export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const walletTypeEnum = pgEnum("wallet_type", [
  "cash",
  "bank",
  "ewallet",
  "savings",
  "investment",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "transfer",
]);

export const categoryTypeEnum = pgEnum("category_type", ["income", "expense"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "rejected"]);

// Workspaces
export const workspace = pgTable("dompetin_workspace", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 10 }).notNull().default("💼"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Workspace Members (Many-to-Many between Users and Workspaces)
export const workspaceMember = pgTable("dompetin_workspace_member", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  workspaceId: uuidColumn("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role")
    .$type<"owner" | "admin" | "member" | "viewer">()
    .notNull()
    .default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Workspace Invitations
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

// Wallets
export const wallet = pgTable("dompetin_wallet", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: text("type")
    .$type<"cash" | "bank" | "ewallet" | "savings" | "investment">()
    .notNull()
    .default("cash"),
  icon: varchar("icon", { length: 50 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  currency: varchar("currency", { length: 3 }).notNull().default("IDR"),
  workspaceId: uuidColumn("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  isArchived: boolean("is_archived")
    .$defaultFn(() => false)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Transactions
export const transaction = pgTable("dompetin_transaction", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  type: text("type")
    .$type<"income" | "expense" | "transfer">()
    .notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  notes: varchar("notes", { length: 1000 }),
  date: date("date", { mode: "date" }).notNull().$defaultFn(() => new Date()),
  categoryId: uuidColumn("category_id").references(() => category.id, {
    onDelete: "set null",
  }),
  walletId: uuidColumn("wallet_id")
    .notNull()
    .references(() => wallet.id, { onDelete: "cascade" }),
  toWalletId: uuidColumn("to_wallet_id").references(() => wallet.id, {
    onDelete: "set null",
  }),
  workspaceId: uuidColumn("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "set null" }),

  // Soft delete fields
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: text("deleted_by").references(() => user.id, {
    onDelete: "set null",
  }),

  // Transaction correction fields
  isCorrection: boolean("is_correction")
    .$defaultFn(() => false)
    .notNull(),
  correctsTransactionId: uuidColumn("corrects_transaction_id").references(
    (): AnyPgColumn => transaction.id,
    {
      onDelete: "set null",
    },
  ),

  // Transfer linkage field
  transferId: uuidColumn("transfer_id"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Categories (Global + Workspace-scoped)
export const category = pgTable("dompetin_category", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  type: text("type").$type<"income" | "expense">().notNull(),
  color: varchar("color", { length: 7 }).notNull(), // Hex color code
  isSystem: boolean("is_system")
    .$defaultFn(() => false) // Default to workspace-scoped
    .notNull(),
  workspaceId: uuidColumn("workspace_id").references(() => workspace.id, {
    onDelete: "cascade",
  }), // Nullable for system categories
  userId: text("user_id").references(() => user.id, {
    onDelete: "set null",
  }), // For tracking category creator
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Budgets
export const budget = pgTable("dompetin_budget", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  spent: numeric("spent", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  period: varchar("period", { length: 20 }).notNull().default("monthly"), // monthly, weekly, yearly
  categoryId: uuidColumn("category_id").references(() => category.id, {
    onDelete: "cascade",
  }),
  workspaceId: uuidColumn("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  startDate: date("start_date", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  endDate: date("end_date", { mode: "date" }),
  isActive: boolean("is_active")
    .$defaultFn(() => true)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Goals
export const goal = pgTable("dompetin_goal", {
  id: uuidColumn("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }),
  targetAmount: numeric("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  targetDate: date("target_date", { mode: "date" }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull().default("🎯"),
  color: varchar("color", { length: 7 }).notNull().default("#6366f1"),
  workspaceId: uuidColumn("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  targetWalletId: uuidColumn("target_wallet_id").references(() => wallet.id, {
    onDelete: "set null",
  }),
  isAchieved: boolean("is_achieved")
    .$defaultFn(() => false)
    .notNull(),
  achievedAt: timestamp("achieved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const workspaceRelations = relations(workspace, ({ many }) => ({
  members: many(workspaceMember),
  wallets: many(wallet),
  transactions: many(transaction),
  budgets: many(budget),
  goals: many(goal),
  invitations: many(invitation),
}));

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

export const workspaceMemberRelations = relations(workspaceMember, ({ one }) => ({
  workspace: one(workspace, {
    fields: [workspaceMember.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [workspaceMember.userId],
    references: [user.id],
  }),
}));

export const walletRelations = relations(wallet, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [wallet.workspaceId],
    references: [workspace.id],
  }),
  transactions: many(transaction, { relationName: "walletTransactions" }),
  incomingTransfers: many(transaction, { relationName: "transferToWallet" }),
  goals: many(goal),
}));

export const transactionRelations = relations(transaction, ({ one }) => ({
  category: one(category, {
    fields: [transaction.categoryId],
    references: [category.id],
  }),
  wallet: one(wallet, {
    fields: [transaction.walletId],
    references: [wallet.id],
    relationName: "walletTransactions",
  }),
  toWallet: one(wallet, {
    fields: [transaction.toWalletId],
    references: [wallet.id],
    relationName: "transferToWallet",
  }),
  workspace: one(workspace, {
    fields: [transaction.workspaceId],
    references: [workspace.id],
  }),
  createdBy: one(user, {
    fields: [transaction.createdBy],
    references: [user.id],
  }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  transactions: many(transaction),
  budgets: many(budget),
}));

export const budgetRelations = relations(budget, ({ one }) => ({
  category: one(category, {
    fields: [budget.categoryId],
    references: [category.id],
  }),
  workspace: one(workspace, {
    fields: [budget.workspaceId],
    references: [workspace.id],
  }),
}));

export const goalRelations = relations(goal, ({ one }) => ({
  workspace: one(workspace, {
    fields: [goal.workspaceId],
    references: [workspace.id],
  }),
  targetWallet: one(wallet, {
    fields: [goal.targetWalletId],
    references: [wallet.id],
  }),
}));
