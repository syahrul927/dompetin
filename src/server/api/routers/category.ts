import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";

import {
  category as categorySchema,
  workspaceMember,
} from "@/server/db/schema";

import { protectedProcedure } from "@/server/api/trpc";
import {
  DEFAULT_CATEGORIES,
  isDefaultCategoryId,
  getDefaultCategoryByPrefixedId,
} from "@/lib/default-categories";

/**
 * Category tRPC Router
 * Handles category management operations
 */
export const categoryRouter = {
  /**
   * Get all categories (DB + hardcoded defaults).
   * Defaults that already exist in DB (matched by name+type) are excluded
   * to avoid duplicates.
   */
  getCategories: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        type: z.enum(["income", "expense"]).optional(),
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

      // Fetch DB categories for this workspace
      const conditions = [
        eq(categorySchema.workspaceId, input.workspaceId)
      ];
      if (input.type) {
        conditions.push(eq(categorySchema.type, input.type));
      }

      const dbCategories = await db.query.category.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
      });

      // Filter defaults: only include those not already in DB (by name+type match)
      const dbNameTypeSet = new Set(
        dbCategories.map((c) => `${c.name}::${c.type}`),
      );

      const filteredDefaults = DEFAULT_CATEGORIES.filter((d) => {
        if (input.type && d.type !== input.type) return false;
        return !dbNameTypeSet.has(`${d.name}::${d.type}`);
      });

      // Build default category objects matching the DB shape
      const now = new Date();
      const defaultRows = filteredDefaults.map((d) => ({
        id: `default:${d.key}`,
        name: d.name,
        icon: d.icon,
        type: d.type,
        color: d.color,
        isSystem: true,
        workspaceId: input.workspaceId ?? null,
        userId: null,
        createdAt: now,
        updatedAt: now,
      }));

      return [...defaultRows, ...dbCategories];
    }),

  /**
   * Resolve a category ID — if it's a default category (prefixed "default:"),
   * lazily insert it into the DB and return the real UUID.
   * If it's already a real UUID, just return it.
   */
  resolveCategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        workspaceId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDefaultCategoryId(input.categoryId)) {
        // Already a real UUID
        return { id: input.categoryId };
      }

      const def = getDefaultCategoryByPrefixedId(input.categoryId);
      if (!def) {
        throw new Error("Unknown default category");
      }

      // Check if already exists in DB (maybe created by another transaction)
      const existing = await db.query.category.findFirst({
        where: and(
          eq(categorySchema.workspaceId, input.workspaceId),
          eq(categorySchema.name, def.name),
          eq(categorySchema.type, def.type),
        ),
      });

      if (existing) {
        return { id: existing.id };
      }

      // Lazy-create in DB
      const [created] = await db
        .insert(categorySchema)
        .values({
          name: def.name,
          icon: def.icon,
          type: def.type,
          color: def.color,
          isSystem: true,
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        })
        .returning({ id: categorySchema.id });

      return { id: created!.id };
    }),

  /**
   * Get system (default) categories
   */
  getSystemCategories: protectedProcedure
    .query(async () => {
      const systemCategories = await db.query.category.findMany({
        where: eq(categorySchema.isSystem, true),
        orderBy: [categorySchema.name],
      });

      return systemCategories;
    }),

  /**
   * Create a new category
   */
  createCategory: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(["income", "expense"]),
        icon: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).length(7),
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

      // Create custom category (isSystem = false)
      const newCategory = await db.insert(categorySchema).values({
        name: input.name,
        type: input.type,
        icon: input.icon,
        color: input.color,
        isSystem: false, // Custom category
        workspaceId: input.workspaceId,
        userId: ctx.session.user.id, // Track creator
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return newCategory;
    }),

  /**
   * Update a category
   */
  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        icon: z.string().min(1).max(50).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).length(7).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing category
      const existingCategory = await db.query.category.findFirst({
        where: eq(categorySchema.id, input.id),
      });

      if (!existingCategory) {
        throw new Error("Category not found");
      }

      // System categories cannot be modified
      if (existingCategory.isSystem === true) {
        throw new Error("System categories cannot be modified");
      }

      if (!existingCategory.workspaceId) {
        throw new Error("Invalid custom category: missing workspace");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, existingCategory.workspaceId),
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

      if (input.icon !== undefined) {
        updateData.icon = input.icon;
      }

      if (input.color !== undefined) {
        updateData.color = input.color;
      }

      // Update category
      const updated = await db
        .update(categorySchema)
        .set(updateData)
        .where(eq(categorySchema.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a category (soft delete)
   */
  deleteCategory: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing category
      const existingCategory = await db.query.category.findFirst({
        where: eq(categorySchema.id, input.id),
      });

      if (!existingCategory) {
        throw new Error("Category not found");
      }

      // System categories cannot be deleted
      if (existingCategory.isSystem === true) {
        throw new Error("System categories cannot be deleted");
      }

      if (!existingCategory.workspaceId) {
        throw new Error("Invalid custom category: missing workspace");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, existingCategory.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // Hard delete category
      await db
        .delete(categorySchema)
        .where(eq(categorySchema.id, input.id))
        .returning();

      return { success: true };
    }),
};
