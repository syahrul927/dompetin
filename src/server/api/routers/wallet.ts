import { z } from "zod";
import { and, eq, desc, sql, isNull, or } from "drizzle-orm";
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
        orderBy: [desc(transactionSchema.date), desc(transactionSchema.createdAt)],
        limit: 20,
        with: {
          wallet: {
            columns: {
              id: true,
              name: true,
            },
          },
          toWallet: {
            columns: {
              id: true,
              name: true,
            },
          },
          category: {
            columns: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
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
   * Recalculate and update wallet balances from transaction history
   * Used for background synchronization of legacy data
   */
  syncBalances: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify user access to workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // 2. Get all wallets in the workspace
      const wallets = await db.query.wallet.findMany({
        where: eq(wallet.workspaceId, input.workspaceId),
      });

      // 3. For each wallet, recalculate its balance
      for (const w of wallets) {
        // Calculate true balance from transactions
        const txResult = await db.select({
          income: sql<number>`COALESCE(SUM(CASE WHEN ${transactionSchema.type} = 'income' THEN ABS(${transactionSchema.amount}::numeric) ELSE 0 END), 0)`,
          expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactionSchema.type} = 'expense' THEN ABS(${transactionSchema.amount}::numeric) ELSE 0 END), 0)`,
          transferIn: sql<number>`COALESCE(SUM(CASE WHEN ${transactionSchema.type} = 'transfer' AND ${transactionSchema.toWalletId} = ${w.id} THEN ABS(${transactionSchema.amount}::numeric) ELSE 0 END), 0)`,
          transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${transactionSchema.type} = 'transfer' AND ${transactionSchema.walletId} = ${w.id} THEN ABS(${transactionSchema.amount}::numeric) ELSE 0 END), 0)`
        }).from(transactionSchema)
        .where(
          and(
            eq(transactionSchema.workspaceId, input.workspaceId),
            isNull(transactionSchema.deletedAt),
            or(
              eq(transactionSchema.walletId, w.id),
              eq(transactionSchema.toWalletId, w.id)
            )
          )
        );

        const stats = txResult[0];
        if (!stats) continue;

        // The true balance = initial balance + income - expense + transferIn - transferOut
        // Since we don't have initial_balance separated, and since legacy transactions
        // didn't update wallet.balance at all, we assume the original initial balance was 0.
        // Or if it was >0, it's currently stored in w.balance, but it might have been
        // updated by newer transactions. The safest approach for total recalculation
        // assuming no transactions updated the balance properly until recently:
        // Assume initial = 0.
        const newBalance = Number(stats.income) - Number(stats.expense) + Number(stats.transferIn) - Number(stats.transferOut);

        // Update the wallet
        await db.update(wallet)
          .set({
            balance: newBalance.toFixed(2),
            updatedAt: new Date()
          })
          .where(eq(wallet.id, w.id));
      }

      return { success: true };
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
