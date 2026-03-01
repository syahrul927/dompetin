import { z } from "zod";
import { and, desc, eq, isNull, sql, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";

import {
  category as categorySchema,
  transaction,
  wallet as walletSchema,
  workspaceMember,
} from "@/server/db/schema";

import { protectedProcedure } from "@/server/api/trpc";

/**
 * Transaction tRPC Router
 * Handles financial transaction operations
 */
export const transactionRouter = {
  /**
   * Get transactions with filtering and pagination
   */
  getTransactions: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        walletId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        type: z.enum(["income", "expense", "transfer"]).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        month: z.number().min(1).max(12).optional(),
        year: z.number().min(2000).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      // Build query conditions
      const conditions = [
        isNull(transaction.deletedAt),
        eq(transaction.workspaceId, input.workspaceId)
      ];

      if (input.walletId) {
        const walletCheck = await db.query.wallet.findFirst({
          where: eq(walletSchema.id, input.walletId),
        });

        if (!walletCheck) {
          throw new Error("Wallet not found");
        }

        // Verify user has access to this workspace
        const member = await db.query.workspaceMember.findFirst({
          where: and(
            eq(workspaceMember.workspaceId, walletCheck.workspaceId),
            eq(workspaceMember.userId, ctx.session.user.id),
          ),
        });

        if (!member) {
          throw new Error("Access denied to this workspace");
        }

        conditions.push(eq(transaction.walletId, input.walletId));
      }

      if (input.categoryId) {
        const categoryCheck = await db.query.category.findFirst({
          where: eq(categorySchema.id, input.categoryId),
        });

        if (!categoryCheck) {
          throw new Error("Category not found");
        }

        conditions.push(eq(transaction.categoryId, input.categoryId));
      }

      if (input.type) {
        conditions.push(eq(transaction.type, input.type));
      }

      if (input.startDate || input.endDate) {
        const dateConditions = [];
        if (input.startDate) {
          dateConditions.push(sql`${transaction.date} >= ${new Date(input.startDate)}`);
        }
        if (input.endDate) {
          dateConditions.push(sql`${transaction.date} <= ${new Date(input.endDate)}`);
        }
        if (dateConditions.length > 0) {
          const dateFilter = and(...dateConditions);
          if (dateFilter) {
            conditions.push(dateFilter);
          }
        }
      }

      if (input.month && input.year) {
        const startOfMonth = new Date(Date.UTC(input.year, input.month - 1, 1));
        const endOfMonth = new Date(Date.UTC(input.year, input.month, 0));
        conditions.push(gte(transaction.date, startOfMonth));
        conditions.push(lte(transaction.date, endOfMonth));
      }

      // Fetch transactions with pagination
      const transactions = await db.query.transaction.findMany({
        where: and(...conditions),
        orderBy: [desc(transaction.date), desc(transaction.createdAt)],
        limit: input.limit,
        offset: input.offset,
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

      // Group transfers and fees into a single entry for the UI
      const groupedTransactions: typeof transactions = [];
      const transferMap = new Map<string, (typeof transactions)[0]>();

      for (const tx of transactions) {
        if (tx.transferId) {
          const existing = transferMap.get(tx.transferId);
          if (existing) {
            // Update existing transfer entry
            if (tx.isTransferFee) {
              // @ts-expect-error - adding virtual property for UI
              existing.feeAmount = Math.abs(Number(tx.amount));
            } else {
              // Ensure the main entry has the positive amount and correct wallets
              const amount = Math.abs(Number(tx.amount));
              existing.amount = amount.toString();

              const isDebit = Number(tx.amount) < 0;
              if (isDebit) {
                existing.wallet = tx.wallet;
                existing.toWallet = tx.toWallet;
              } else {
                // @ts-expect-error - swapping wallet for display normalization
                existing.wallet = tx.toWallet;
                existing.toWallet = tx.wallet;
              }
            }
            continue;
          } else {
            // New transfer group
            // Create a shallow copy to avoid mutating the original array elements
            const groupedTx = { ...tx };

            if (tx.isTransferFee) {
              // If we saw the fee first, set it up as a transfer
              groupedTx.type = "transfer";
              // @ts-expect-error - adding virtual property for UI
              groupedTx.feeAmount = Math.abs(Number(tx.amount));
              groupedTx.amount = "0"; // To be filled by other legs
            } else {
              // @ts-expect-error - adding virtual property for UI
              groupedTx.feeAmount = 0;
              groupedTx.amount = Math.abs(Number(tx.amount)).toString();
            }

            transferMap.set(tx.transferId, groupedTx);
            groupedTransactions.push(groupedTx);
          }
        } else {
          groupedTransactions.push(tx);
        }
      }

      return {
        transactions: groupedTransactions,
        hasMore: transactions.length === input.limit,
      };
    }),

  /**
   * Get a single transaction by ID
   */
  getTransaction: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const transactionData = await db.query.transaction.findFirst({
        where: eq(transaction.id, input.id),
        with: {
          wallet: {
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
          toWallet: {
            columns: {
              id: true,
              name: true,
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

      if (!transactionData) {
        throw new Error("Transaction not found");
      }

      return transactionData;
    }),

  /**
   * Create a new transaction
   */
  createTransaction: protectedProcedure
    .input(
      z.object({
        type: z.enum(["income", "expense", "transfer"]),
        amount: z.number().positive(), // Amount in cents
        name: z.string().min(1).max(255),
        notes: z.string().max(1000).optional(),
        date: z.string().datetime(),
        walletId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        toWalletId: z.string().uuid().optional(),
        budgetId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify wallet access
      const walletCheck = await db.query.wallet.findFirst({
        where: eq(walletSchema.id, input.walletId),
      });

      if (!walletCheck) {
        throw new Error("Wallet not found");
      }

      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, walletCheck.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      // For transfers, verify toWallet access
      if (input.type === "transfer" && input.toWalletId) {
        const toWalletCheck = await db.query.wallet.findFirst({
          where: eq(walletSchema.id, input.toWalletId),
        });

        if (!toWalletCheck) {
          throw new Error("Destination wallet not found");
        }

        // Verify user has access to destination workspace
        const toMember = await db.query.workspaceMember.findFirst({
          where: and(
            eq(workspaceMember.workspaceId, toWalletCheck.workspaceId),
            eq(workspaceMember.userId, ctx.session.user.id),
          ),
        });

        if (!toMember) {
          throw new Error("Access denied to destination workspace");
        }
      }

      // Verify category belongs to workspace if provided
      if (input.categoryId) {
        const categoryCheck = await db.query.category.findFirst({
          where: eq(categorySchema.id, input.categoryId),
        });

        if (!categoryCheck) {
          throw new Error("Category not found");
        }

        // Verify category belongs to same workspace
        if (categoryCheck.workspaceId !== walletCheck.workspaceId) {
          throw new Error("Category must belong to the same workspace as wallet");
        }
      }

      const transactionId = crypto.randomUUID();
      const workspaceId = walletCheck.workspaceId;

      // Convert amount from cents to database format (decimal)
      const amountDb = (input.amount / 100).toFixed(2);

      // Create transaction and update wallet balance atomically
      await db.transaction(async (tx) => {
        await tx.insert(transaction).values({
          id: transactionId,
          type: input.type,
          amount: amountDb,
          name: input.name,
          notes: input.notes ?? null,
          date: new Date(input.date),
          categoryId: input.categoryId ?? null,
          budgetId: input.budgetId ?? null,
          walletId: input.walletId,
          toWalletId: input.toWalletId ?? null,
          workspaceId,
          createdBy: ctx.session.user.id,
        });

        // Get current wallet balance
        const currentWallet = await tx.query.wallet.findFirst({
          where: eq(walletSchema.id, input.walletId),
        });

        if (!currentWallet) throw new Error("Wallet not found during update");

        const currentBalance = Number(currentWallet.balance);
        const amountNum = Number(amountDb);

        // Update wallet balance safely in TypeScript
        if (input.type === "income") {
          await tx
            .update(walletSchema)
            .set({
              balance: (currentBalance + amountNum).toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(walletSchema.id, input.walletId));
        } else if (input.type === "expense") {
          await tx
            .update(walletSchema)
            .set({
              balance: (currentBalance - amountNum).toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(walletSchema.id, input.walletId));
        }
      });

      return { id: transactionId };
    }),

  /**
   * Create a transfer transaction (atomic)
   */
  createTransfer: protectedProcedure
    .input(
      z.object({
        fromWalletId: z.string().uuid(),
        toWalletId: z.string().uuid(),
        amount: z.number().positive(), // Amount in cents
        feeAmount: z.number().nonnegative().optional(), // Transfer fee amount in cents
        name: z.string().min(1).max(255),
        notes: z.string().max(1000).optional(),
        date: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify both wallets exist and user has access
      const [fromWallet, toWallet] = await Promise.all([
        db.query.wallet.findFirst({
          where: eq(walletSchema.id, input.fromWalletId),
        }),
        db.query.wallet.findFirst({
          where: eq(walletSchema.id, input.toWalletId),
        }),
      ]);

      if (!fromWallet || !toWallet) {
        throw new Error("One or both wallets not found");
      }

      // Verify user has access to both workspaces
      const [fromMember, toMember] = await Promise.all([
        db.query.workspaceMember.findFirst({
          where: and(
            eq(workspaceMember.workspaceId, fromWallet.workspaceId),
            eq(workspaceMember.userId, ctx.session.user.id),
          ),
        }),
        db.query.workspaceMember.findFirst({
          where: and(
            eq(workspaceMember.workspaceId, toWallet.workspaceId),
            eq(workspaceMember.userId, ctx.session.user.id),
          ),
        }),
      ]);

      if (!fromMember || !toMember) {
        throw new Error("Access denied to one or both wallets");
      }

      const workspaceId = fromWallet.workspaceId;
      const transferId = crypto.randomUUID();

      // Convert amount from cents to database format
      const amountNum = input.amount / 100;
      const amountDb = amountNum.toFixed(2);
      const feeAmountNum = input.feeAmount ? input.feeAmount / 100 : 0;
      const feeAmountDb = feeAmountNum.toFixed(2);
      const dateDb = new Date(input.date);

      // Use database transaction for atomicity
      await db.transaction(async (tx) => {
        // Fetch both wallets fresh inside transaction
        const currentFromWallet = await tx.query.wallet.findFirst({
          where: eq(walletSchema.id, input.fromWalletId),
        });
        const currentToWallet = await tx.query.wallet.findFirst({
          where: eq(walletSchema.id, input.toWalletId),
        });

        if (!currentFromWallet || !currentToWallet)
          throw new Error("One or both wallets not found during update");

        // Debit transaction (from wallet)
        await tx.insert(transaction).values({
          id: transferId,
          type: "transfer",
          amount: `-${amountDb}`, // Negative amount (deduction)
          name: input.name,
          notes: input.notes ?? null,
          date: dateDb,
          walletId: input.fromWalletId,
          toWalletId: input.toWalletId,
          transferId,
          workspaceId,
          createdBy: ctx.session.user.id,
        });

        // Credit transaction (to wallet)
        await tx.insert(transaction).values({
          id: crypto.randomUUID(),
          type: "transfer",
          amount: amountDb, // Positive amount (addition)
          name: input.name,
          notes: input.notes ?? null,
          date: dateDb,
          walletId: input.toWalletId,
          toWalletId: input.fromWalletId,
          transferId,
          workspaceId,
          createdBy: ctx.session.user.id,
        });

        // Deduct both transfer amount and fee from the source wallet
        await tx
          .update(walletSchema)
          .set({
            balance: (
              Number(currentFromWallet.balance) -
              amountNum -
              feeAmountNum
            ).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(walletSchema.id, input.fromWalletId));

        // Update destination wallet
        await tx
          .update(walletSchema)
          .set({
            balance: (Number(currentToWallet.balance) + amountNum).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(walletSchema.id, input.toWalletId));

        // If fee exists, find/create category and insert fee transaction
        if (feeAmountNum > 0) {
          let feeCategory = await tx.query.category.findFirst({
            where: and(
              eq(categorySchema.workspaceId, workspaceId),
              eq(categorySchema.name, "Biaya Transfer"),
              eq(categorySchema.type, "expense"),
            ),
          });

          if (!feeCategory) {
            const [newCat] = await tx
              .insert(categorySchema)
              .values({
                id: crypto.randomUUID(),
                workspaceId,
                name: "Biaya Transfer",
                type: "expense",
                icon: "receipt",
                color: "#f43f5e", // rose-500
                userId: ctx.session.user.id,
              })
              .returning();
            feeCategory = newCat;
          }

          await tx.insert(transaction).values({
            id: crypto.randomUUID(),
            type: "expense",
            amount: feeAmountDb,
            name: "Biaya Admin Transfer",
            date: dateDb,
            walletId: input.fromWalletId,
            transferId, // Link to the transfer
            categoryId: feeCategory!.id,
            isTransferFee: true,
            workspaceId,
            createdBy: ctx.session.user.id,
          });
        }
      });

      return { id: transferId };
    }),

  /**
   * Update a transaction
   */
  updateTransaction: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().positive().optional(),
        name: z.string().min(1).max(255).optional(),
        notes: z.string().max(1000).optional(),
        date: z.string().datetime().optional(),
        categoryId: z.string().uuid().optional(),
        budgetId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get existing transaction
      const existingTx = await db.query.transaction.findFirst({
        where: eq(transaction.id, input.id),
      });

      if (!existingTx) {
        throw new Error("Transaction not found");
      }

      // Verify creator ONLY authorization
      if (existingTx.createdBy !== ctx.session.user.id) {
        throw new Error("Only the creator can edit this transaction");
      }

      // If transfer, block updates to specific fields
      if (existingTx.type === "transfer" && (input.amount !== undefined || input.categoryId !== undefined)) {
        throw new Error("Cannot update amount or category for transfer transactions");
      }

      // Verify category belongs to workspace if provided
      if (input.categoryId) {
        const categoryCheck = await db.query.category.findFirst({
          where: eq(categorySchema.id, input.categoryId),
        });

        if (!categoryCheck) {
          throw new Error("Category not found");
        }

        if (categoryCheck.workspaceId !== existingTx.workspaceId) {
          throw new Error("Category must belong to the same workspace as transaction");
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.amount !== undefined) {
        // Convert from cents to decimal format
        updateData.amount = (input.amount / 100).toFixed(2);
      }

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      if (input.date !== undefined) {
        updateData.date = new Date(input.date);
      }

      if (input.categoryId !== undefined) {
        updateData.categoryId = input.categoryId;
      }

      if (input.budgetId !== undefined) {
        updateData.budgetId = input.budgetId;
      }

      // Update transaction
      const updated = await db.transaction(async (tx) => {
        const [result] = await tx
          .update(transaction)
          .set(updateData)
          .where(eq(transaction.id, input.id))
          .returning();

        // If this is part of a transfer, sync name, notes, and date to other legs
        if (existingTx.transferId) {
          const syncData: Record<string, unknown> = {
            updatedAt: new Date(),
          };
          if (input.notes !== undefined) syncData.notes = input.notes;
          if (input.date !== undefined) syncData.date = new Date(input.date);

          // Update other legs (excluding the fee name)
          await tx
            .update(transaction)
            .set(syncData)
            .where(
              and(
                eq(transaction.transferId, existingTx.transferId),
                eq(transaction.isTransferFee, false),
                sql`${transaction.id} != ${input.id}`,
              ),
            );

          // For the fee transaction, sync notes and date, and optionally name with prefix
          const feeSyncData = { ...syncData };
          if (input.name !== undefined) {
            feeSyncData.name = `Biaya Admin Transfer: ${input.name}`;
          }

          await tx
            .update(transaction)
            .set(feeSyncData)
            .where(
              and(
                eq(transaction.transferId, existingTx.transferId),
                eq(transaction.isTransferFee, true),
                sql`${transaction.id} != ${input.id}`,
              ),
            );

          // If updating name for a main leg, update name for the other main leg too
          if (input.name !== undefined) {
            await tx
              .update(transaction)
              .set({ name: input.name, updatedAt: new Date() })
              .where(
                and(
                  eq(transaction.transferId, existingTx.transferId),
                  eq(transaction.isTransferFee, false),
                  sql`${transaction.id} != ${input.id}`,
                ),
              );
          }
        }

        return result;
      });

      return updated;
    }),

  /**
   * Get dashboard summary: monthly income/expense + daily trend
   */
  getDashboardSummary: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      // Monthly totals
      const monthlyResult = await db
        .select({
          monthIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN ${transaction.amount} ELSE 0 END), 0)`,
          monthExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN ABS(${transaction.amount}) ELSE 0 END), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            isNull(transaction.deletedAt),
            eq(transaction.date, today)
          ),
        );

      // Daily expense trend for last 7 days
      const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));

      const dailyTrend = await db
        .select({
          day: sql<string>`TO_CHAR(${transaction.date}::timestamp, 'YYYY-MM-DD')`,
          total: sql<string>`COALESCE(SUM(ABS(${transaction.amount})), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            eq(transaction.type, "expense"),
            isNull(transaction.deletedAt),
            gte(transaction.date, sevenDaysAgo),
            lte(transaction.date, today),
          ),
        )
        .groupBy(sql`TO_CHAR(${transaction.date}::timestamp, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${transaction.date}::timestamp, 'YYYY-MM-DD')`);

      // Fill in missing days with 0
      const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
      const trendMap = new Map(dailyTrend.map((d) => [d.day, parseFloat(d.total)]));
      const trend: { label: string; value: number }[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setUTCDate(d.getUTCDate() + i);
        const key = d.toISOString().split("T")[0]!;
        trend.push({
          label: dayNames[d.getUTCDay()]!,
          value: trendMap.get(key) ?? 0,
        });
      }

      const monthly = monthlyResult[0];

      return {
        monthlyIncome: parseFloat(monthly?.monthIncome ?? "0"),
        monthlyExpense: parseFloat(monthly?.monthExpense ?? "0"),
        trend,
      };
    }),

  /**
   * Get expense breakdown by category for the current month
   */
  getExpenseByCategory: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        month: z.number().min(1).max(12).optional(),
        year: z.number().min(2000).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Access denied to this workspace");
      }

      const now = new Date();
      const currentYear = input.year ?? now.getUTCFullYear();
      const currentMonth = input.month ?? now.getUTCMonth() + 1;

      const result = await db
        .select({
          categoryId: transaction.categoryId,
          categoryName: categorySchema.name,
          categoryIcon: categorySchema.icon,
          categoryColor: categorySchema.color,
          total: sql<string>`COALESCE(SUM(ABS(${transaction.amount})), 0)`,
        })
        .from(transaction)
        .leftJoin(categorySchema, eq(transaction.categoryId, categorySchema.id))
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            eq(transaction.type, "expense"),
            isNull(transaction.deletedAt),
            sql`EXTRACT(YEAR FROM ${transaction.date}::timestamp) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${transaction.date}::timestamp) = ${currentMonth}`,
          ),
        )
        .groupBy(
          transaction.categoryId,
          categorySchema.name,
          categorySchema.icon,
          categorySchema.color,
        )
        .orderBy(sql`SUM(ABS(${transaction.amount})) DESC`);

      const categories = result.map((r) => ({
        id: r.categoryId,
        name: r.categoryName ?? "Tanpa Kategori",
        icon: r.categoryIcon ?? "📦",
        color: r.categoryColor ?? "#94a3b8",
        total: parseFloat(r.total),
      }));

      const grandTotal = categories.reduce((sum, c) => sum + c.total, 0);

      return { categories, grandTotal };
    }),

  /**
   * Delete a transaction (Hard delete + balance reversion)
   */
  deleteTransaction: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch transaction
      const existingTx = await db.query.transaction.findFirst({
        where: eq(transaction.id, input.id),
      });

      if (!existingTx) {
        throw new Error("Transaction not found");
      }

      // 2. Verify creator ONLY authorization
      if (existingTx.createdBy !== ctx.session.user.id) {
        throw new Error("Only the creator can delete this transaction");
      }

      // 3. Database transaction to delete and revert balances
      await db.transaction(async (tx) => {
        if (existingTx.transferId) {
          // Handle linked transfer group (Debit, Credit, and optional Fee)
          const relatedTransactions = await tx.query.transaction.findMany({
            where: eq(transaction.transferId, existingTx.transferId),
          });

          for (const relTx of relatedTransactions) {
            const amountAbs = Math.abs(Number(relTx.amount));

            if (relTx.type === "transfer") {
              const isDebit = Number(relTx.amount) < 0;
              const currentWallet = await tx.query.wallet.findFirst({
                where: eq(walletSchema.id, relTx.walletId),
              });

              if (currentWallet) {
                await tx
                  .update(walletSchema)
                  .set({
                    balance: (isDebit
                      ? Number(currentWallet.balance) + amountAbs
                      : Number(currentWallet.balance) - amountAbs
                    ).toFixed(2),
                    updatedAt: new Date(),
                  })
                  .where(eq(walletSchema.id, relTx.walletId));
              }
            } else if (relTx.type === "expense" && relTx.isTransferFee) {
              // Revert fee: add back to wallet
              const currentWallet = await tx.query.wallet.findFirst({
                where: eq(walletSchema.id, relTx.walletId),
              });

              if (currentWallet) {
                await tx
                  .update(walletSchema)
                  .set({
                    balance: (Number(currentWallet.balance) + amountAbs).toFixed(2),
                    updatedAt: new Date(),
                  })
                  .where(eq(walletSchema.id, relTx.walletId));
              }
            }
          }

          // Delete all transactions in the group
          await tx.delete(transaction).where(eq(transaction.transferId, existingTx.transferId));
        } else {
          // Handle regular transaction (existing logic)
          await tx.delete(transaction).where(eq(transaction.id, input.id));

          const amountAbs = Math.abs(Number(existingTx.amount));
          const currentWallet = await tx.query.wallet.findFirst({
            where: eq(walletSchema.id, existingTx.walletId),
          });

          if (currentWallet) {
            await tx
              .update(walletSchema)
              .set({
                balance: (existingTx.type === "income"
                  ? Number(currentWallet.balance) - amountAbs
                  : Number(currentWallet.balance) + amountAbs
                ).toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(walletSchema.id, existingTx.walletId));
          }
        }
      });

      return { success: true };
    }),

  /**
   * Get transaction analytics (income/expense totals and daily trend)
   */
  getTransactionAnalytics: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        month: z.number().min(1).max(12),
        year: z.number().min(2000),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      // Current month boundaries
      const startOfMonth = new Date(Date.UTC(input.year, input.month - 1, 1));
      const endOfMonth = new Date(Date.UTC(input.year, input.month, 0));

      // Previous month boundaries
      const prevMonthDate = new Date(Date.UTC(input.year, input.month - 2, 1));
      const startOfPrevMonth = new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth(), 1));
      const endOfPrevMonth = new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() + 1, 0));

      // Query totals for current month
      const currentTotals = await db
        .select({
          income: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN ${transaction.amount} ELSE 0 END), 0)`,
          expense: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN ABS(${transaction.amount}) ELSE 0 END), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            isNull(transaction.deletedAt),
            gte(transaction.date, startOfMonth),
            lte(transaction.date, endOfMonth),
          ),
        );

      // Query totals for previous month
      const prevTotals = await db
        .select({
          income: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN ${transaction.amount} ELSE 0 END), 0)`,
          expense: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN ABS(${transaction.amount}) ELSE 0 END), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            isNull(transaction.deletedAt),
            gte(transaction.date, startOfPrevMonth),
            lte(transaction.date, endOfPrevMonth),
          ),
        );

      // Daily cashflow for current month
      const dailyCashflow = await db
        .select({
          day: sql<string>`TO_CHAR(${transaction.date}::timestamp, 'YYYY-MM-DD')`,
          income: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN ${transaction.amount} ELSE 0 END), 0)`,
          expense: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN ABS(${transaction.amount}) ELSE 0 END), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            isNull(transaction.deletedAt),
            gte(transaction.date, startOfMonth),
            lte(transaction.date, endOfMonth),
          ),
        )
        .groupBy(sql`TO_CHAR(${transaction.date}::timestamp, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${transaction.date}::timestamp, 'YYYY-MM-DD')`);

      const current = currentTotals[0]!;
      const previous = prevTotals[0]!;

      const income = parseFloat(current.income);
      const expense = parseFloat(current.expense);
      const prevIncome = parseFloat(previous.income);
      const prevExpense = parseFloat(previous.expense);

      // Calculate percentage changes
      const calculateChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      };

      const incomeChange = calculateChange(income, prevIncome);
      const expenseChange = calculateChange(expense, prevExpense);

      // Aggregate into weekly buckets for the chart
      const cashflowMap = new Map(dailyCashflow.map(d => [d.day, { income: parseFloat(d.income), expense: parseFloat(d.expense) }]));
      const cashflow: { date: string, income: number, expense: number }[] = [];

      const daysInMonth = endOfMonth.getUTCDate();

      let currentWeek = 1;
      let currentWeekIncome = 0;
      let currentWeekExpense = 0;

      for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(Date.UTC(input.year, input.month - 1, i));
        const key = dateObj.toISOString().split('T')[0]!;
        const data = cashflowMap.get(key) ?? { income: 0, expense: 0 };

        currentWeekIncome += data.income;
        currentWeekExpense += data.expense;

        // Group into 7-day buckets, or remainder for the last week
        if (i % 7 === 0 || i === daysInMonth) {
          const startDay = (currentWeek - 1) * 7 + 1;
          const endDay = i;

          cashflow.push({
            date: startDay === endDay ? `${startDay}` : `${startDay}-${endDay}`,
            income: currentWeekIncome,
            expense: currentWeekExpense
          });
          currentWeek++;
          currentWeekIncome = 0;
          currentWeekExpense = 0;
        }
      }

      return {
        summary: {
          income,
          expense,
          incomeChange,
          expenseChange,
        },
        cashflow,
      };
    }),
};
