import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { webhook, workspaceMember } from "@/server/db/schema";
import { protectedProcedure } from "@/server/api/trpc";
import { generateShortcutKey, hashShortcutKey } from "@/server/lib/shortcut-key";

/**
 * Webhook integration tRPC Router
 * One integration per user per workspace. Plain key shown only on
 * create/regenerate; only sha256 hash is stored.
 */
export const webhookRouter = {
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });
      if (!member) throw new Error("Access denied");

      const existing = await db.query.webhook.findFirst({
        where: and(
          eq(webhook.workspaceId, input.workspaceId),
          eq(webhook.userId, ctx.session.user.id),
        ),
      });
      if (existing) {
        throw new Error("You already have a webhook for this workspace. Regenerate the key instead.");
      }

      const plainKey = generateShortcutKey();
      const [created] = await db
        .insert(webhook)
        .values({
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
          name: input.name,
          keyHash: hashShortcutKey(plainKey),
        })
        .returning({
          id: webhook.id,
          name: webhook.name,
          createdAt: webhook.createdAt,
        });

      return { webhook: created!, secretKey: plainKey };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });
      if (!member) throw new Error("Access denied");

      return db.query.webhook.findMany({
        where: and(
          eq(webhook.workspaceId, input.workspaceId),
          eq(webhook.userId, ctx.session.user.id),
        ),
        columns: {
          id: true,
          name: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: webhook.createdAt,
      });
    }),

  regenerate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await db.query.webhook.findFirst({
        where: eq(webhook.id, input.id),
      });
      if (!row || row.userId !== ctx.session.user.id) {
        throw new Error("Access denied");
      }

      const plainKey = generateShortcutKey();
      await db
        .update(webhook)
        .set({ keyHash: hashShortcutKey(plainKey), updatedAt: new Date() })
        .where(eq(webhook.id, input.id));

      return { secretKey: plainKey };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await db.query.webhook.findFirst({
        where: eq(webhook.id, input.id),
      });
      if (!row || row.userId !== ctx.session.user.id) {
        throw new Error("Access denied");
      }

      await db.delete(webhook).where(eq(webhook.id, input.id));
      return { success: true };
    }),
};
