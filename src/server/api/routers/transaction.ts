import { z } from "zod";
import { and, desc, eq, inArray, isNull, sql, gte, lte, lt } from "drizzle-orm";
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

      // NEW: Batch fetch all transfer pieces to avoid N+1 and handle split pages
      const transferIds = [
        ...new Set(
          transactions
            .map((t) => t.transferId)
            .filter((id): id is string => id !== null),
        ),
      ];

      let allTransferPieces: typeof transactions = [];
      if (transferIds.length > 0) {
        allTransferPieces = await db.query.transaction.findMany({
          where: and(
            isNull(transaction.deletedAt),
            inArray(transaction.transferId, transferIds),
          ),
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
      }

      // Group transfers and fees into a single entry for the UI
      const groupedTransactions: typeof transactions = [];
      const processedTransferIds = new Set<string>();

      // Map to store combined transfer data
      const transferDataMap = new Map<string, (typeof transactions)[0]>();

      // Pre-process all transfer pieces
      for (const piece of allTransferPieces) {
        if (!piece.transferId) continue;

        let existing = transferDataMap.get(piece.transferId);
        if (!existing) {
          // Initialize with a copy of the piece
          existing = { ...piece };
          if (existing.isTransferFee) {
            existing.type = "transfer";
          }
          // @ts-expect-error - adding virtual property for UI
          existing.feeAmount = 0;
          transferDataMap.set(piece.transferId, existing);
        }

        if (piece.isTransferFee) {
          // @ts-expect-error - adding virtual property for UI
          existing.feeAmount = Math.abs(Number(piece.amount));
        } else {
          // Main leg (debit or credit)
          existing.type = "transfer";
          const amount = Math.abs(Number(piece.amount));
          existing.amount = amount.toString();

          const isDebit = Number(piece.amount) < 0;
          if (isDebit) {
            existing.wallet = piece.wallet;
            existing.toWallet = piece.toWallet;
          } else {
            // Credit leg: piece.wallet is destination, piece.toWallet is source
            // @ts-expect-error - swapping wallet for display normalization
            existing.wallet = piece.toWallet;
            existing.toWallet = piece.wallet;
          }
        }
      }

      for (const tx of transactions) {
        if (tx.transferId) {
          if (processedTransferIds.has(tx.transferId)) continue;

          const grouped = transferDataMap.get(tx.transferId);
          if (grouped) {
            groupedTransactions.push(grouped);
            processedTransferIds.add(tx.transferId);
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
          workspaceId: currentToWallet.workspaceId,
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
        feeAmount: z.number().nonnegative().optional(),
        walletId: z.string().uuid().optional(),
        toWalletId: z.string().uuid().optional(),
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

      // If transfer, block updates to category (transfers don't have categories)
      if (existingTx.type === "transfer" && input.categoryId !== undefined) {
        throw new Error("Cannot update category for transfer transactions");
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

      // Verify wallet(s) belong to workspace if provided
      if (input.walletId) {
        const walletCheck = await db.query.wallet.findFirst({
          where: eq(walletSchema.id, input.walletId),
        });
        if (!walletCheck || walletCheck.workspaceId !== existingTx.workspaceId) {
          throw new Error("Wallet not found or access denied");
        }
      }

      if (input.toWalletId) {
        if (existingTx.type !== "transfer") {
          throw new Error("Destination wallet can only be set for transfers");
        }
        const walletCheck = await db.query.wallet.findFirst({
          where: eq(walletSchema.id, input.toWalletId),
        });
        if (!walletCheck || walletCheck.workspaceId !== existingTx.workspaceId) {
          throw new Error("Destination wallet not found or access denied");
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.amount !== undefined) {
        // For transfer debit legs, we store negative amounts
        const isTransferDebit =
          existingTx.type === "transfer" && Number(existingTx.amount) < 0;
        updateData.amount = (isTransferDebit
          ? -(input.amount / 100)
          : input.amount / 100
        ).toFixed(2);
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

      if (input.walletId !== undefined) {
        updateData.walletId = input.walletId;
      }

      if (input.toWalletId !== undefined) {
        updateData.toWalletId = input.toWalletId;
      }

      // Update transaction and wallet balance atomically
      const updated = await db.transaction(async (tx) => {
        // 1. Handle Balance Reversions (Before updating records)
        // Only if amount, walletId, toWalletId, or feeAmount is changing
        const isAmountChanging = input.amount !== undefined;
        const isWalletChanging = input.walletId !== undefined;
        const isToWalletChanging = input.toWalletId !== undefined;
        const isFeeChanging = input.feeAmount !== undefined;

        if (
          isAmountChanging ||
          isWalletChanging ||
          isToWalletChanging ||
          isFeeChanging
        ) {
          if (existingTx.type === "transfer" && existingTx.transferId) {
            // TRANSFER RECONCILIATION
            // Fetch all current legs
            const legs = await tx.query.transaction.findMany({
              where: and(
                eq(transaction.transferId, existingTx.transferId),
                isNull(transaction.deletedAt),
              ),
            });

            const debitLeg = legs.find(
              (l) => !l.isTransferFee && Number(l.amount) < 0,
            );
            const creditLeg = legs.find(
              (l) => !l.isTransferFee && Number(l.amount) > 0,
            );
            const feeLeg = legs.find((l) => l.isTransferFee);

            // Revert Old Balances
            if (debitLeg) {
              const w = await tx.query.wallet.findFirst({
                where: eq(walletSchema.id, debitLeg.walletId),
              });
              if (w) {
                const totalDebit =
                  Math.abs(Number(debitLeg.amount)) +
                  (feeLeg ? Math.abs(Number(feeLeg.amount)) : 0);
                await tx
                  .update(walletSchema)
                  .set({
                    balance: (Number(w.balance) + totalDebit).toFixed(2),
                    updatedAt: new Date(),
                  })
                  .where(eq(walletSchema.id, w.id));
              }
            }
            if (creditLeg) {
              const w = await tx.query.wallet.findFirst({
                where: eq(walletSchema.id, creditLeg.walletId),
              });
              if (w) {
                await tx
                  .update(walletSchema)
                  .set({
                    balance: (
                      Number(w.balance) - Math.abs(Number(creditLeg.amount))
                    ).toFixed(2),
                    updatedAt: new Date(),
                  })
                  .where(eq(walletSchema.id, w.id));
              }
            }

            // Update Records
            const newAmountNum =
              input.amount !== undefined
                ? input.amount / 100
                : Math.abs(Number(debitLeg?.amount ?? existingTx.amount));

            // ALWAYS use the debit leg's walletId as source and credit leg's walletId as destination
            // to ensure consistency regardless of which leg the user clicked to edit.
            const newWalletId = input.walletId ?? debitLeg?.walletId ?? existingTx.walletId;
            const newToWalletId = input.toWalletId ?? creditLeg?.walletId ?? existingTx.toWalletId!;

            // Update Main Legs
            if (debitLeg) {
              await tx
                .update(transaction)
                .set({
                  amount: (-newAmountNum).toFixed(2),
                  walletId: newWalletId,
                  toWalletId: newToWalletId,
                  updatedAt: new Date(),
                })
                .where(eq(transaction.id, debitLeg.id));
            }
            if (creditLeg) {
              await tx
                .update(transaction)
                .set({
                  amount: newAmountNum.toFixed(2),
                  walletId: newToWalletId as string,
                  toWalletId: newWalletId,
                  updatedAt: new Date(),
                })
                .where(eq(transaction.id, creditLeg.id));
            }

            // Handle Fee Leg
            let finalFeeAmount = feeLeg ? Math.abs(Number(feeLeg.amount)) : 0;
            if (input.feeAmount !== undefined) {
              finalFeeAmount = input.feeAmount / 100;

              if (feeLeg) {
                if (finalFeeAmount > 0) {
                  await tx
                    .update(transaction)
                    .set({
                      amount: finalFeeAmount.toFixed(2),
                      walletId: newWalletId,
                      updatedAt: new Date(),
                    })
                    .where(eq(transaction.id, feeLeg.id));
                } else {
                  await tx
                    .update(transaction)
                    .set({
                      deletedAt: new Date(),
                      deletedBy: ctx.session.user.id,
                      updatedAt: new Date(),
                    })
                    .where(eq(transaction.id, feeLeg.id));
                }
              } else if (finalFeeAmount > 0) {
                // Create new fee leg
                const workspaceId = existingTx.workspaceId;
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
                      color: "#f43f5e",
                      userId: ctx.session.user.id,
                    })
                    .returning();
                  feeCategory = newCat;
                }

                await tx.insert(transaction).values({
                  id: crypto.randomUUID(),
                  type: "expense",
                  amount: finalFeeAmount.toFixed(2),
                  name: `Biaya Admin Transfer: ${input.name ?? existingTx.name}`,
                  date: input.date ? new Date(input.date) : existingTx.date,
                  notes: input.notes ?? existingTx.notes,
                  walletId: newWalletId,
                  transferId: existingTx.transferId,
                  categoryId: feeCategory!.id,
                  isTransferFee: true,
                  workspaceId,
                  createdBy: ctx.session.user.id,
                });
              }
            } else if (feeLeg) {
              // Sync fee leg wallet even if amount didn't change
              await tx
                .update(transaction)
                .set({ walletId: newWalletId, updatedAt: new Date() })
                .where(eq(transaction.id, feeLeg.id));
            }

            // Apply New Balances
            const wSource = await tx.query.wallet.findFirst({
              where: eq(walletSchema.id, newWalletId),
            });
            if (wSource) {
              await tx
                .update(walletSchema)
                .set({
                  balance: (
                    Number(wSource.balance) -
                    (newAmountNum + finalFeeAmount)
                  ).toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(walletSchema.id, wSource.id));
            }

            const wDest = await tx.query.wallet.findFirst({
              where: eq(walletSchema.id, newToWalletId as string),
            });
            if (wDest) {
              await tx
                .update(walletSchema)
                .set({
                  balance: (Number(wDest.balance) + newAmountNum).toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(walletSchema.id, wDest.id));
            }
          } else {
            // REGULAR TRANSACTION RECONCILIATION
            const oldWalletId = existingTx.walletId;
            const newWalletId = input.walletId ?? oldWalletId;
            const oldAmount = Number(existingTx.amount);
            const newAmount =
              input.amount !== undefined
                ? input.amount / 100
                : Math.abs(oldAmount);

            // Revert old wallet
            const wOld = await tx.query.wallet.findFirst({
              where: eq(walletSchema.id, oldWalletId),
            });
            if (wOld) {
              const reversion = existingTx.type === "expense" ? oldAmount : -oldAmount;
              await tx
                .update(walletSchema)
                .set({
                  balance: (Number(wOld.balance) + reversion).toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(walletSchema.id, oldWalletId));
            }

            // Apply new wallet
            const wNew = await tx.query.wallet.findFirst({
              where: eq(walletSchema.id, newWalletId),
            });
            if (wNew) {
              const applyAmount = existingTx.type === "expense" ? -newAmount : newAmount;
              await tx
                .update(walletSchema)
                .set({
                  balance: (Number(wNew.balance) + applyAmount).toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(walletSchema.id, newWalletId));
            }
          }
        }

        // 2. Perform the main update for fields other than amount/wallet (if already handled)
        // We use updateData but remove amount/walletId/toWalletId if it's a transfer to avoid double update
        const finalUpdateData = { ...updateData };
        if (existingTx.type === "transfer") {
          delete finalUpdateData.amount;
          delete finalUpdateData.walletId;
          delete finalUpdateData.toWalletId;
        }

        const [result] = await tx
          .update(transaction)
          .set(finalUpdateData)
          .where(eq(transaction.id, input.id))
          .returning();

        // 3. Handle other field syncing for transfers (name, notes, date)
        if (existingTx.transferId) {
          const syncData: Record<string, unknown> = {
            updatedAt: new Date(),
          };
          if (input.notes !== undefined) syncData.notes = input.notes;
          if (input.date !== undefined) syncData.date = new Date(input.date);

          // Sync notes and date to ALL other legs
          if (Object.keys(syncData).length > 1) {
            await tx
              .update(transaction)
              .set(syncData)
              .where(
                and(
                  eq(transaction.transferId, existingTx.transferId),
                  sql`${transaction.id} != ${input.id}`,
                  isNull(transaction.deletedAt),
                ),
              );
          }

          // Sync name if updating from a main leg
          if (input.name !== undefined && !existingTx.isTransferFee) {
            // Update other main leg
            await tx
              .update(transaction)
              .set({ name: input.name, updatedAt: new Date() })
              .where(
                and(
                  eq(transaction.transferId, existingTx.transferId),
                  eq(transaction.isTransferFee, false),
                  sql`${transaction.id} != ${input.id}`,
                  isNull(transaction.deletedAt),
                ),
              );

            // Update fee leg name with prefix
            await tx
              .update(transaction)
              .set({
                name: `Biaya Admin Transfer: ${input.name}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(transaction.transferId, existingTx.transferId),
                  eq(transaction.isTransferFee, true),
                  isNull(transaction.deletedAt),
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
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

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
            gte(transaction.date, startOfMonth),
            lte(transaction.date, endOfMonth)
          ),
        );

      // Daily totals (today only)
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const dailyResult = await db
        .select({
          dayIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'income' THEN ${transaction.amount} ELSE 0 END), 0)`,
          dayExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} = 'expense' THEN ABS(${transaction.amount}) ELSE 0 END), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.workspaceId, input.workspaceId),
            isNull(transaction.deletedAt),
            gte(transaction.date, today),
            lt(transaction.date, tomorrow)
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
      const daily = dailyResult[0];

      return {
        monthlyIncome: parseFloat(monthly?.monthIncome ?? "0"),
        monthlyExpense: parseFloat(monthly?.monthExpense ?? "0"),
        dailyIncome: parseFloat(daily?.dayIncome ?? "0"),
        dailyExpense: parseFloat(daily?.dayExpense ?? "0"),
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

      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0));

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
            gte(transaction.date, startOfMonth),
            lte(transaction.date, endOfMonth),
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
      if (existingTx.transferId) {
        const linkedTxs = await db.query.transaction.findMany({
          where: and(
            eq(transaction.transferId, existingTx.transferId),
            isNull(transaction.deletedAt),
          ),
        });

        await db.transaction(async (tx) => {
          for (const linked of linkedTxs) {
            // Soft delete
            await tx
              .update(transaction)
              .set({ deletedAt: new Date(), deletedBy: ctx.session.user.id })
              .where(eq(transaction.id, linked.id));

            // Refund wallet balances
            const wallet = await tx.query.wallet.findFirst({
              where: eq(walletSchema.id, linked.walletId),
            });
            if (wallet) {
              const refundAmount =
                linked.type === "transfer" && !linked.amount.startsWith("-")
                  ? -Number(linked.amount) // Undo credit
                  : Math.abs(Number(linked.amount)); // Undo debit or expense fee

              await tx
                .update(walletSchema)
                .set({
                  balance: (Number(wallet.balance) + refundAmount).toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(walletSchema.id, wallet.id));
            }
          }
        });

        return { success: true };
      }

      // Handle regular transaction (soft delete)
      await db.transaction(async (tx) => {
        await tx
          .update(transaction)
          .set({
            deletedAt: new Date(),
            deletedBy: ctx.session.user.id,
          })
          .where(eq(transaction.id, input.id));

        const amountAbs = Math.abs(Number(existingTx.amount));
        const currentWallet = await tx.query.wallet.findFirst({
          where: eq(walletSchema.id, existingTx.walletId),
        });

        if (currentWallet) {
          await tx
            .update(walletSchema)
            .set({
              balance: (
                existingTx.type === "income"
                  ? Number(currentWallet.balance) - amountAbs
                  : Number(currentWallet.balance) + amountAbs
              ).toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(walletSchema.id, existingTx.walletId));
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
