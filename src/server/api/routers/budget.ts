import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";

import {
  budget as budgetSchema,
  category as categorySchema,
  transaction,
  workspaceMember,
} from "@/server/db/schema";

import { protectedProcedure } from "@/server/api/trpc";

/**
 * Budget tRPC Router
 * Handles budget management operations
 */
export const budgetRouter = {
  /**
   * Get all budgets for a workspace
   */
  getBudgets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Build query conditions
      const conditions = [
        eq(budgetSchema.isActive, input.isActive),
        eq(budgetSchema.workspaceId, input.workspaceId)
      ];

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Use a subquery to get total spent per category in the current month
      const spentSubquery = db
        .select({
          budgetId: transaction.budgetId,
          totalSpent: sql<number>`COALESCE(SUM(ABS(${transaction.amount}::numeric)), 0)`.as('total_spent'),
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            eq(transaction.type, "expense"),
            isNull(transaction.deletedAt),
            sql`EXTRACT(YEAR FROM ${transaction.date}::timestamp) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${transaction.date}::timestamp) = ${currentMonth}`
          )
        )
        .groupBy(transaction.budgetId)
        .as('spent_subquery');

      const budgets = await db
        .select({
          id: budgetSchema.id,
          name: budgetSchema.name,
          amount: budgetSchema.amount,
          icon: budgetSchema.icon,
          color: budgetSchema.color,
          spent: sql<number>`COALESCE(${spentSubquery.totalSpent}, 0)`,
        })
        .from(budgetSchema)
        .leftJoin(spentSubquery, eq(budgetSchema.id, spentSubquery.budgetId))
        .where(
          and(
            eq(budgetSchema.workspaceId, input.workspaceId),
            eq(budgetSchema.isActive, input.isActive)
          )
        )
        .orderBy(desc(budgetSchema.createdAt));

      // Convert string amounts to numbers
      return budgets.map((b) => ({
        ...b,
        amount: parseFloat(b.amount as unknown as string),
        spent: Number(b.spent),
      }));
    }),

  /**
   * Get a single budget by ID
   */
  getBudget: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const budgetData = await db.query.budget.findFirst({
        where: eq(budgetSchema.id, input.id),
      });

      if (!budgetData) {
        throw new Error("Budget not found");
      }

      // Calculate spent amount for this budget
      const currentMonth = new Date();
      const currentYear = currentMonth.getFullYear();
      const currentMonthIdx = currentMonth.getMonth();

      const spentResult = await db
        .select({
          totalSpent: sql<number>`COALESCE(SUM(ABS(${transaction.amount}::numeric)), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.budgetId, budgetData.id),
            eq(transaction.type, "expense"),
            isNull(transaction.deletedAt), // Exclude soft-deleted
            sql`EXTRACT(YEAR FROM ${transaction.date}::timestamp) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${transaction.date}::timestamp) = ${currentMonthIdx + 1}`,
          ),
        );

      const totalSpent = Number(spentResult[0]?.totalSpent ?? 0);

      return {
        ...budgetData,
        totalSpent,
        remaining: Number(budgetData.amount) - totalSpent,
        percentage: totalSpent > 0
          ? Math.min((totalSpent / Number(budgetData.amount)) * 100, 100).toFixed(2)
          : "0",
      };
    }),

  /**
   * Create a new budget
   */
  createBudget: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        amount: z.number().positive(), // Amount in cents
        period: z.enum(["monthly", "weekly", "yearly"]).default("monthly"),
        icon: z.string().min(1).max(50).default("💰"),
        color: z.string().min(1).max(7).default("#3b82f6"),
        workspaceId: z.string().uuid(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
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

      // Convert amount from cents to decimal format
      const amountDb = (input.amount / 100).toFixed(2);
      const startDateDb = input.startDate ? new Date(input.startDate) : new Date();
      const endDateDb = input.endDate ? new Date(input.endDate) : null;

      // Create budget
      const [newBudget] = await db.insert(budgetSchema).values({
        name: input.name,
        amount: amountDb,
        spent: "0",
        period: input.period,
        icon: input.icon,
        color: input.color,
        workspaceId: input.workspaceId,
        startDate: startDateDb,
        endDate: endDateDb,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return newBudget;
    }),

  /**
   * Update a budget
   */
  updateBudget: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        amount: z.number().positive().optional(),
        period: z.enum(["monthly", "weekly", "yearly"]).optional(),
        icon: z.string().min(1).max(50).optional(),
        color: z.string().min(1).max(7).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing budget
      const existingBudget = await db.query.budget.findFirst({
        where: eq(budgetSchema.id, input.id),
      });

      if (!existingBudget) {
        throw new Error("Budget not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, existingBudget.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.amount !== undefined) {
        // Convert from cents to decimal format
        updateData.amount = (input.amount / 100).toFixed(2);
      }

      if (input.period !== undefined) {
        updateData.period = input.period;
      }

      if (input.icon !== undefined) {
        updateData.icon = input.icon;
      }

      if (input.color !== undefined) {
        updateData.color = input.color;
      }

      if (input.startDate !== undefined) {
        updateData.startDate = new Date(input.startDate);
      }

      if (input.endDate !== undefined) {
        updateData.endDate = input.endDate ? new Date(input.endDate) : null;
      }

      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      // Update budget
      const updated = await db
        .update(budgetSchema)
        .set(updateData)
        .where(eq(budgetSchema.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a budget
   */
  deleteBudget: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing budget
      const existingBudget = await db.query.budget.findFirst({
        where: eq(budgetSchema.id, input.id),
      });

      if (!existingBudget) {
        throw new Error("Budget not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, existingBudget.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Delete budget (cascades to category)
      await db.delete(budgetSchema).where(eq(budgetSchema.id, input.id));

      return { success: true };
    }),
};
