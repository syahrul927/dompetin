import { createCallerFactory, createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

import { workspaceRouter } from "./routers/workspace";
import { walletRouter } from "./routers/wallet";
import { transactionRouter } from "./routers/transaction";
import { categoryRouter } from "./routers/category";
import { budgetRouter } from "./routers/budget";
import { goalRouter } from "./routers/goal";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  /**
   * Hello procedure for health check
   */
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name}!`,
      };
    }),

  /**
   * Workspace router
   */
  workspace: workspaceRouter,

  /**
   * Wallet router
   */
  wallet: walletRouter,

  /**
   * Transaction router
   */
  transaction: transactionRouter,

  /**
   * Category router
   */
  category: categoryRouter,

  /**
   * Budget router
   */
  budget: budgetRouter,

  /**
   * Goal router
   */
  goal: goalRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.workspace.all();
 *       ^? Workspace[]
 */
export const createCaller = createCallerFactory(appRouter);
