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

      if (input.categoryId) {
        // Verify category exists and belongs to workspace
        const categoryCheck = await db.query.category.findFirst({
          where: eq(categorySchema.id, input.categoryId),
        });

        if (!categoryCheck) {
          throw new Error("Category not found");
        }

        if (categoryCheck.workspaceId !== input.workspaceId) {
          throw new Error("Category must belong to the same workspace");
        }

        conditions.push(eq(budgetSchema.categoryId, input.categoryId));
      }

      // Fetch budgets
      const budgets = await db.query.budget.findMany({
        where: and(...conditions),
        orderBy: [desc(budgetSchema.createdAt)],
        with: {
          category: {
            columns: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
        },
      });

      return budgets;
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
        with: {
          category: {
            columns: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
        },
      });

      if (!budgetData) {
        throw new Error("Budget not found");
      }

      // Calculate spent amount for this budget
      const currentMonth = new Date();
      const currentYear = currentMonth.getFullYear();
      const currentMonthIdx = currentMonth.getMonth();

      if (!budgetData.categoryId) {
        throw new Error("Budget is missing category reference");
      }

      const spentResult = await db
        .select({
          totalSpent: sql<number>`COALESCE(SUM(${budgetSchema.amount}), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.categoryId, budgetData.categoryId),
            isNull(transaction.deletedAt), // Exclude soft-deleted
            sql`EXTRACT(YEAR FROM ${transaction.date}) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${transaction.date}) = ${currentMonthIdx + 1}`,
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
        categoryId: z.string().uuid(),
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

      // Verify category exists and belongs to workspace
      const categoryCheck = await db.query.category.findFirst({
        where: eq(categorySchema.id, input.categoryId),
      });

      if (!categoryCheck) {
        throw new Error("Category not found");
      }

      if (categoryCheck.workspaceId !== input.workspaceId) {
        throw new Error("Category must belong to the same workspace as budget");
      }

      // Convert amount from cents to decimal format
      const amountDb = (input.amount / 100).toFixed(2);
      const startDateDb = input.startDate ? new Date(input.startDate) : new Date();
      const endDateDb = input.endDate ? new Date(input.endDate) : null;

      // Create budget
      const newBudget = await db.insert(budgetSchema).values({
        name: input.name,
        amount: amountDb,
        spent: "0",
        period: input.period,
        categoryId: input.categoryId,
        workspaceId: input.workspaceId,
        startDate: startDateDb,
        endDate: endDateDb,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

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
        categoryId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing budget
      const existingBudget = await db.query.budget.findFirst({
        where: eq(budgetSchema.id, input.id),
        with: {
          category: {
            columns: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
        },
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

      // If category changed, verify it belongs to workspace
      if (input.categoryId !== undefined && input.categoryId !== existingBudget.categoryId) {
        const categoryCheck = await db.query.category.findFirst({
          where: eq(categorySchema.id, input.categoryId),
        });

        if (!categoryCheck) {
          throw new Error("Category not found");
        }

        if (categoryCheck.workspaceId !== existingBudget.workspaceId) {
          throw new Error("Category must belong to the same workspace as budget");
        }
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

      if (input.categoryId !== undefined) {
        updateData.categoryId = input.categoryId;
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
