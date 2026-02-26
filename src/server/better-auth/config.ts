import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "@/env";
import { db } from "@/server/db";
import { workspace, workspaceMember } from "@/server/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
      redirectURI: env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/api/auth/callback/google`
        : "http://localhost:3000/api/auth/callback/google",
      enabled: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const workspaceId = crypto.randomUUID();

          await db.insert(workspace).values({
            id: workspaceId,
            name: "Personal",
            icon: "💼",
            ownerId: user.id,
          });

          await db.insert(workspaceMember).values({
            workspaceId,
            userId: user.id,
            role: "owner",
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
