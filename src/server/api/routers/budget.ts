import { z } from "zod";
import { and, desc, eq, isNull, sql, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";

import {
  budget as budgetSchema,
  transaction,
  workspaceMember,
} from "@/server/db/schema";

import { protectedProcedure } from "@/server/api/trpc";
import { getPeriodBoundaries, type BudgetPeriod } from "@/lib/date-utils";

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

      // 1. Fetch requested budgets
      const budgets = await db.query.budget.findMany({
        where: and(
          eq(budgetSchema.workspaceId, input.workspaceId),
          eq(budgetSchema.isActive, input.isActive)
        ),
        orderBy: [desc(budgetSchema.createdAt)],
      });

      const now = new Date();
      const updatedBudgets = [];

      // 2. Process Auto-Renewal for active budgets
      if (input.isActive) {
        for (const b of budgets) {
          // Check if budget has expired
          if (b.endDate && b.endDate < now) {
            // Archive old budget
            await db.update(budgetSchema)
              .set({ isActive: false, updatedAt: new Date() })
              .where(eq(budgetSchema.id, b.id));

            // Create new budget for current period
            const { start, end } = getPeriodBoundaries(b.period as BudgetPeriod);

            // Just double checking that the new start date is actually after the old end date
            // If they are generating budgets rapidly, we don't want an infinite loop.
            if (end.getTime() <= b.endDate.getTime()) {
                // Failsafe in case auto-renew logic fires in a tight loop during the same calendar block
                updatedBudgets.push(b);
                continue;
            }

            const [newBudget] = await db.insert(budgetSchema).values({
              name: b.name,
              amount: b.amount,
              spent: "0",
              period: b.period,
              icon: b.icon,
              color: b.color,
              workspaceId: b.workspaceId,
              startDate: start,
              endDate: end,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();

            if (newBudget) {
              updatedBudgets.push(newBudget);
            }
          } else {
            updatedBudgets.push(b);
          }
        }
      } else {
        updatedBudgets.push(...budgets);
      }

      // 3. Calculate accurate spent amount for each budget based on its specific dates
      const results = await Promise.all(updatedBudgets.map(async (b) => {
        if (!b) return null;

        const spentResult = await db
          .select({
            totalSpent: sql<number>`COALESCE(SUM(ABS(${transaction.amount}::numeric)), 0)`,
          })
          .from(transaction)
          .where(
            and(
              eq(transaction.budgetId, b.id),
              eq(transaction.type, "expense"),
              isNull(transaction.deletedAt),
              gte(transaction.date, b.startDate!),
              b.endDate ? lte(transaction.date, b.endDate) : undefined
            )
          );

        return {
          ...b,
          amount: parseFloat(b.amount as string),
          spent: Number(spentResult[0]?.totalSpent ?? 0),
        };
      }));

      return results.filter((r): r is NonNullable<typeof r> => r !== null);
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
            gte(transaction.date, budgetData.startDate),
            budgetData.endDate ? lte(transaction.date, budgetData.endDate) : undefined,
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
        period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"),
        icon: z.string().min(1).max(50).default("💰"),
        color: z.string().min(1).max(7).default("#3b82f6"),
        workspaceId: z.string().uuid(),
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

      // We need to parse dates carefully to prevent timezone shift issues on insertion.
      // Drizzle ORM's date('date', { mode: 'date' }) type parses native Date objects to ISO strings under the hood.
      // And when they get returned, they are strings like "2026-03-01".
      const { start, end } = getPeriodBoundaries(input.period);

      // Keep dates in local time shift, not pure UTC to avoid boundary bleeding if local DB timezone differs.
      // But getPeriodBoundaries returns new Date() with the local year, month, date.
      // That's what we want.

      // Create budget
      const [newBudget] = await db.insert(budgetSchema).values({
        name: input.name,
        amount: amountDb,
        spent: "0",
        period: input.period,
        icon: input.icon,
        color: input.color,
        workspaceId: input.workspaceId,
        startDate: start,
        endDate: end,
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
        period: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
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

        // Also update dates if period changes, so it matches the new period from today
        const { start, end } = getPeriodBoundaries(input.period);
        updateData.startDate = start;
        updateData.endDate = end;
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
