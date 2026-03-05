import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { nanoid } from "nanoid";

import {
  splitBill,
  splitBillParticipant,
  workspaceMember,
  transaction as transactionSchema,
  wallet,
} from "@/server/db/schema";

import { protectedProcedure, publicProcedure, createTRPCRouter } from "@/server/api/trpc";

const participantItemSchema = z.object({
  name: z.string(),
  qty: z.number(),
  price: z.number(),
  subtotal: z.number(),
});

const participantSchema = z.object({
  name: z.string(),
  isOwner: z.boolean(),
  items: z.array(participantItemSchema),
  taxShare: z.number(),
  discountShare: z.number(),
  total: z.number(),
});

export const splitBillRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        title: z.string().max(255),
        subtotal: z.number(),
        tax: z.number().default(0),
        discount: z.number().default(0),
        total: z.number(),
        participants: z.array(participantSchema).min(1),
      })
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

      const shareCode = nanoid(8);

      const [newSplitBill] = await db
        .insert(splitBill)
        .values({
          workspaceId: input.workspaceId,
          title: input.title,
          subtotal: input.subtotal.toString(),
          tax: input.tax.toString(),
          discount: input.discount.toString(),
          total: input.total.toString(),
          shareCode,
          createdBy: ctx.session.user.id,
        })
        .returning({ id: splitBill.id });

      if (!newSplitBill) {
        throw new Error("Failed to create split bill");
      }

      const participantValues = input.participants.map((p) => ({
        splitBillId: newSplitBill.id,
        name: p.name,
        isOwner: p.isOwner,
        items: JSON.stringify(p.items),
        taxShare: p.taxShare.toString(),
        discountShare: p.discountShare.toString(),
        total: p.total.toString(),
      }));

      await db.insert(splitBillParticipant).values(participantValues);

      return { id: newSplitBill.id, shareCode };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bill = await db.query.splitBill.findFirst({
        where: eq(splitBill.id, input.id),
        with: {
          participants: true,
        },
      });

      if (!bill) {
        throw new Error("Split bill not found");
      }

      // Verify workspace access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, bill.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      return {
        ...bill,
        participants: bill.participants.map(p => ({
          ...p,
          items: JSON.parse(p.items) as z.infer<typeof participantItemSchema>[],
        }))
      };
    }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const bill = await db.query.splitBill.findFirst({
        where: eq(splitBill.shareCode, input.code),
        with: {
          participants: true,
        },
      });

      if (!bill) {
        throw new Error("Split bill not found");
      }

      return {
        ...bill,
        participants: bill.participants.map(p => ({
          ...p,
          items: JSON.parse(p.items) as z.infer<typeof participantItemSchema>[],
        }))
      };
    }),

  addToTransaction: protectedProcedure
    .input(
      z.object({
        splitBillId: z.string().uuid(),
        walletId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        date: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bill = await db.query.splitBill.findFirst({
        where: eq(splitBill.id, input.splitBillId),
        with: {
          participants: true,
        },
      });

      if (!bill) {
        throw new Error("Split bill not found");
      }

      if (bill.transactionId) {
        throw new Error("Split bill already linked to a transaction");
      }

      // Verify workspace access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, bill.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }
      
      const ownerParticipant = bill.participants.find(p => p.isOwner);
      if (!ownerParticipant) {
        throw new Error("No owner found for this split bill");
      }

      const amount = ownerParticipant.total;

      const [newTransaction] = await db
        .insert(transactionSchema)
        .values({
          workspaceId: bill.workspaceId,
          walletId: input.walletId,
          categoryId: input.categoryId,
          type: "expense",
          amount: amount.toString(),
          name: bill.title,
          date: new Date(input.date),
          notes: `Split bill: ${bill.title}`,
          createdBy: ctx.session.user.id,
        })
        .returning({ id: transactionSchema.id });
        
      if (!newTransaction) {
        throw new Error("Failed to create transaction");
      }

      await db
        .update(splitBill)
        .set({ transactionId: newTransaction.id })
        .where(eq(splitBill.id, bill.id));

      await db
        .update(wallet)
        .set({ balance: sql`${wallet.balance} - ${amount}` })
        .where(eq(wallet.id, input.walletId));

      return { success: true, transactionId: newTransaction.id };
    }),
});
