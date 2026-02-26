import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/server/db";

import {
  goal as goalSchema,
  wallet as walletSchema,
  workspaceMember,
} from "@/server/db/schema";

import { protectedProcedure } from "@/server/api/trpc";

/**
 * Goal tRPC Router
 * Handles financial goal management operations
 */
export const goalRouter = {
  /**
   * Get all goals for a workspace
   */
  getGoals: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        isAchieved: z.boolean().default(false),
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
        eq(goalSchema.workspaceId, input.workspaceId)
      ];

      if (!input.isAchieved) {
        conditions.push(eq(goalSchema.isAchieved, false));
      }

      // Fetch goals
      const goals = await db.query.goal.findMany({
        where: and(...conditions),
        orderBy: [desc(goalSchema.targetDate)],
        with: {
          targetWallet: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return goals;
    }),

  /**
   * Get a single goal by ID
   */
  getGoal: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const goalData = await db.query.goal.findFirst({
        where: eq(goalSchema.id, input.id),
        with: {
          targetWallet: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!goalData) {
        throw new Error("Goal not found");
      }

      // Calculate progress percentage
      const targetAmount = Number(goalData.targetAmount);
      const currentAmount = Number(goalData.currentAmount);
      const percentage = targetAmount > 0
        ? Math.min((currentAmount / targetAmount) * 100, 100).toFixed(2)
        : "0";

      return {
        ...goalData,
        percentage,
        isAchieved: goalData.isAchieved,
        remaining: targetAmount - currentAmount,
      };
    }),

  /**
   * Create a new goal
   */
  createGoal: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        targetAmount: z.number().positive(), // Amount in cents
        targetDate: z.string().datetime(),
        targetWalletId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        icon: z.string().min(1).max(50).default("🎯"),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).length(7).default("#6366f1"),
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

      // Verify target wallet exists and user has access
      const walletCheck = await db.query.wallet.findFirst({
        where: eq(walletSchema.id, input.targetWalletId),
      });

      if (!walletCheck) {
        throw new Error("Target wallet not found");
      }

      const walletMember = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, walletCheck.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!walletMember) {
        throw new Error("Access denied to this workspace");
      }

      // Convert amount from cents to decimal format
      const targetAmountDb = (input.targetAmount / 100).toFixed(2);
      const targetDateDb = new Date(input.targetDate);

      // Create goal
      const newGoal = await db.insert(goalSchema).values({
        name: input.name,
        description: input.description ?? null,
        targetAmount: targetAmountDb,
        currentAmount: "0",
        targetDate: targetDateDb,
        icon: input.icon,
        color: input.color,
        workspaceId: input.workspaceId,
        targetWalletId: input.targetWalletId,
        isAchieved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return { id: newGoal[0]?.id };
    }),

  /**
   * Update a goal
   */
  updateGoal: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        targetAmount: z.number().positive().optional(),
        targetDate: z.string().datetime().optional(),
        targetWalletId: z.string().uuid().optional(),
        icon: z.string().min(1).max(50).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).length(7).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing goal
      const existingGoal = await db.query.goal.findFirst({
        where: eq(goalSchema.id, input.id),
        with: {
          targetWallet: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!existingGoal) {
        throw new Error("Goal not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, existingGoal.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // If target wallet changed, verify it belongs to workspace
      if (input.targetWalletId !== undefined && input.targetWalletId !== existingGoal.targetWalletId) {
        const walletCheck = await db.query.wallet.findFirst({
          where: eq(walletSchema.id, input.targetWalletId),
        });

        if (!walletCheck) {
          throw new Error("Target wallet not found");
        }

        const walletMember = await db.query.workspaceMember.findFirst({
          where: and(
            eq(workspaceMember.workspaceId, walletCheck.workspaceId),
            eq(workspaceMember.userId, ctx.session.user.id),
          ),
        });

        if (!walletMember) {
          throw new Error("Access denied to target wallet workspace");
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      if (input.targetAmount !== undefined) {
        // Convert from cents to decimal format
        updateData.targetAmount = (input.targetAmount / 100).toFixed(2);
      }

      if (input.targetDate !== undefined) {
        updateData.targetDate = new Date(input.targetDate);
      }

      if (input.targetWalletId !== undefined) {
        updateData.targetWalletId = input.targetWalletId;
      }

      if (input.icon !== undefined) {
        updateData.icon = input.icon;
      }

      if (input.color !== undefined) {
        updateData.color = input.color;
      }

      // Check if goal should be marked as achieved
      const currentAmount = Number(existingGoal.currentAmount);
      const targetAmount = Number(existingGoal.targetAmount);
      const isAchieved = currentAmount >= targetAmount;

      if (isAchieved && !existingGoal.isAchieved) {
        // Goal reached - mark as achieved
        updateData.isAchieved = true;
        updateData.achievedAt = new Date();
      } else if (!isAchieved && existingGoal.isAchieved) {
        // Goal not reached - unmark
        updateData.isAchieved = false;
        updateData.achievedAt = null;
      }

      // Update goal
      const updated = await db
        .update(goalSchema)
        .set(updateData)
        .where(eq(goalSchema.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Update goal progress (add funds)
   */
  updateProgress: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().positive(), // Amount in cents to add
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing goal
      const existingGoal = await db.query.goal.findFirst({
        where: eq(goalSchema.id, input.id),
      });

      if (!existingGoal) {
        throw new Error("Goal not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, existingGoal.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      if (!existingGoal.targetWalletId) {
        throw new Error("Goal has no target wallet");
      }

      // Verify target wallet exists and user has access
      const walletCheck = await db.query.wallet.findFirst({
        where: eq(walletSchema.id, existingGoal.targetWalletId),
      });

      if (!walletCheck) {
        throw new Error("Target wallet not found");
      }

      const walletMember = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, walletCheck.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!walletMember) {
        throw new Error("Access denied to target wallet workspace");
      }

      // Convert amount from cents to decimal format
      const amountToAdd = (input.amount / 100).toFixed(2);

      // Add to current amount
      const currentAmount = Number(existingGoal.currentAmount);
      const newAmount = (currentAmount + Number(amountToAdd)).toFixed(2);

      // Update goal
      const updated = await db
        .update(goalSchema)
        .set({
          currentAmount: newAmount,
        })
        .where(eq(goalSchema.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a goal
   */
  deleteGoal: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing goal
      const existingGoal = await db.query.goal.findFirst({
        where: eq(goalSchema.id, input.id),
      });

      if (!existingGoal) {
        throw new Error("Goal not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, existingGoal.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Delete goal
      await db.delete(goalSchema).where(eq(goalSchema.id, input.id));

      return { success: true };
    }),
};
