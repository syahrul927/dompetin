# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dompetin is a personal finance management application built with the T3 Stack:
- **Framework**: Next.js 15 (App Router, RSC enabled by default)
- **Language**: TypeScript with strict mode and `noUncheckedIndexedAccess`
- **Package Manager**: pnpm
- **Authentication**: Better Auth v1.3+ with email/password and GitHub OAuth
- **Database**: PostgreSQL with Drizzle ORM
- **API**: tRPC v11 for end-to-end type safety
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **PWA**: next-pwa v5.6 with offline support and install prompts

## Development Commands

### Running the Application
```bash
pnpm dev          # Start development server with Turbo
pnpm build        # Build for production
pnpm start        # Start production server
pnpm preview      # Build and start production server
```

### Database Management
```bash
./start-database.sh    # Start local PostgreSQL container via Docker/Podman
pnpm db:generate       # Generate Drizzle migrations from schema changes
pnpm db:migrate        # Apply pending migrations to database
pnpm db:push          # Push schema changes directly to database (dev only)
pnpm db:studio        # Open Drizzle Studio (database GUI)
pnpm db:seed          # Run database seed script
```

### Code Quality
```bash
pnpm check          # Run ESLint and TypeScript check
pnpm lint           # Run ESLint only
pnpm lint:fix       # Fix ESLint errors automatically
pnpm typecheck      # Run TypeScript type checking
pnpm format:check   # Check Prettier formatting
pnpm format:write   # Apply Prettier formatting
```

## Architecture

### Project Structure

```
src/
├── app/                    # Next.js App Router (Server Components by default)
│   ├── api/
│   │   ├── auth/[...all]/  # Better Auth API handler
│   │   └── trpc/[trpc]/    # tRPC API handler
│   ├── dashboard/           # Dashboard pages
│   ├── budget/              # Budget management
│   ├── goals/               # Savings goals
│   ├── wallets/             # Wallet/account management
│   ├── workspace/           # Workspace (multi-tenancy)
│   ├── login/               # Login page
│   ├── register/            # Registration page
│   ├── layout.tsx          # Root layout with PWA and auth integration
│   └── page.tsx            # Home page
├── components/
│   ├── ui/                 # shadcn/ui components (use these first)
│   └── pwa/                # PWA-specific components (install prompts, offline indicator)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions and helpers
│   ├── pwa/                # PWA utilities (service worker registration, helpers)
│   └── utils.ts            # cn() utility for className merging
├── server/
│   ├── api/
│   │   ├── trpc.ts         # tRPC context and procedures (publicProcedure, protectedProcedure)
│   │   ├── root.ts         # Main router that aggregates all sub-routers
│   │   └── routers/        # Domain-specific tRPC routers
│   │       ├── workspace.ts
│   │       ├── wallet.ts
│   │       ├── transaction.ts
│   │       ├── category.ts
│   │       ├── budget.ts
│   │       └── goal.ts
│   ├── better-auth/         # Better Auth configuration
│   │   ├── config.ts       # Auth providers, database adapter
│   │   ├── client.ts       # Client-side auth utilities
│   │   ├── server.ts       # Server-side auth utilities
│   │   └── index.ts       # Auth exports
│   └── db/
│       ├── dompetin-schema.ts  # Dompetin-specific schema (workspace, wallet, transaction, etc.)
│       ├── schema.ts           # Better Auth schema (user, session, account, etc.)
│       └── index.ts           # Database connection export
└── trpc/
    ├── react.tsx          # Client-side tRPC setup with React Query
    ├── server.ts          # Server-side tRPC caller (for server components)
    └── query-client.ts    # React Query client configuration
```

### tRPC Architecture

**tRPC Context**: Created in `src/server/api/trpc.ts` includes:
- `db`: Database connection
- `session`: User session from Better Auth (may be null for public procedures)
- `headers`: Request headers

**Procedure Types**:
- `publicProcedure`: Unauthenticated, includes timing middleware (adds artificial delay in dev)
- `protectedProcedure`: Requires authenticated session, guarantees `ctx.session.user` is non-null

**Adding New Routes**:
1. Create router in `src/server/api/routers/[name].ts`
2. Export from `src/server/api/root.ts`
3. Use `publicProcedure` or `protectedProcedure` wrappers
4. Return typed responses, use Zod for input validation

**Server-side Calls** (in Server Components):
```typescript
import { createCaller } from "@/server/api/root";
import { auth } from "@/server/better-auth";

const trpc = createCaller({ db, session: await auth.api.getSession({ headers: request.headers }) });
const result = await trpc.workspace.all();
```

**Client-side Calls** (in Client Components):
```typescript
import { api } from "@/trpc/react";

const { data } = api.workspace.all.useQuery();
```

### Database Schema

**Two Schema Files**:
1. `src/server/db/schema.ts` - Better Auth tables (user, session, account, verification)
2. `src/server/db/dompetin-schema.ts` - Dompetin domain tables

**Domain Entities**:
- `workspace`: Multi-tenant workspace with members
- `workspaceMember`: Many-to-many users-to-workspaces with roles
- `wallet`: Accounts (cash, bank, ewallet, savings, investment) with balance tracking
- `transaction`: Income/expense/transfer with soft delete, correction tracking
- `category`: Income/expense categories, system or workspace-scoped
- `budget`: Category-based budget tracking with period support
- `goal`: Savings goals with target amounts and dates

**Key Patterns**:
- All monetary values: `numeric(15, 2)` (Drizzle returns as string, convert carefully)
- Soft deletes: `deletedAt` and `deletedBy` fields (query with `isNull(transaction.deletedAt)`)
- Transfer transactions: `type: "transfer"`, `walletId` (from) and `toWalletId` (to)
- Corrections: `isCorrection: true`, `correctsTransactionId` references original

### Authentication (Better Auth)

**Configuration**: `src/server/better-auth/config.ts`
- Providers: Email/password + GitHub OAuth
- Adapter: Drizzle with PostgreSQL
- Session: Database-backed

**Session Access**:
```typescript
// Server components
import { auth } from "@/server/better-auth";
const session = await auth.api.getSession({ headers: request.headers });

// Client components
import { authClient } from "@/server/better-auth/client";
const { data: session } = await authClient.getSession();
```

**Auth Routes**:
- `/api/auth/*` - All Better Auth endpoints (handled by `[...all]/route.ts`)
- No manual auth API routes needed

### PWA Configuration

**Service Worker**: Disabled in development, enabled in production via `next.config.js`

**Cache Strategies** (configured in `next.config.js`):
- `dompetin-v1-api`: tRPC API routes (StaleWhileRevalidate, 5 min TTL)
- `dompetin-v1-offline`: General requests (NetworkFirst, 200 entries)
- `dompetin-v1-images`: Images (CacheFirst, 30 days)
- `dompetin-v1-static`: Static assets (CacheFirst, 30 days)

**PWA Components** (`src/components/pwa/`):
- `InstallPrompt`: Native install prompts for Chrome/Edge, instructions for iOS
- `InstallBanner`: Banner shown after page views for iOS
- `OfflineIndicator`: Visual feedback for online/offline status

**Testing PWA**: Must use production build (`pnpm build && pnpm start`), service worker is disabled in dev mode

### Styling (Tailwind v4 + shadcn/ui)

**CSS Variables**: `src/styles/globals.css` uses `@theme` inline with oklch color space

**Color Scheme**:
- Primary: Black (`oklch(0.205 0 0)`) in light mode
- Background: White (`oklch(1 0 0)`) in light mode
- Dark mode: Inverted colors

**Component Usage**:
- Import from `@/components/ui/[component]`
- Use `cn()` utility from `@/lib/utils` for className merging
- Prefer shadcn/ui components over custom UI

**Dark Mode**: Uses `next-themes`, automatic based on system preference

## Environment Variables

Required environment variables (see `.env.example`):
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/dompetin"
BETTER_AUTH_SECRET=""                    # Required in production only
BETTER_AUTH_GITHUB_CLIENT_ID=""          # GitHub OAuth
BETTER_AUTH_GITHUB_CLIENT_SECRET=""      # GitHub OAuth
```

Add new variables to `src/env.js` (server) and `src/env.js` (client with `NEXT_PUBLIC_` prefix)

## Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./src/*`

Component aliases (from `components.json`):
- `@/components` → `src/components`
- `@/components/ui` → `src/components/ui`
- `@/lib` → `src/lib`
- `@/lib/utils` → `src/lib/utils`
- `@/hooks` → `src/hooks`

## Common Patterns

### Adding a New tRPC Router

```typescript
// src/server/api/routers/example.ts
import { protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { db } from "@/server/db";
import { example } from "@/server/db/schema";

export const exampleRouter = {
  getAll: publicProcedure
    .query(async ({ ctx }) => {
      return db.query.example.findMany();
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.insert(example).values({
        name: input.name,
        createdBy: ctx.session.user.id,
      });
    }),
};
```

### Database Query with Drizzle

```typescript
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { transaction, wallet } from "@/server/db/schema";

// Simple query
const transactions = await db.query.transaction.findMany({
  where: eq(transaction.workspaceId, workspaceId),
  orderBy: [desc(transaction.date)],
});

// Query with relations
const walletWithTransactions = await db.query.wallet.findFirst({
  where: eq(wallet.id, walletId),
  with: {
    transactions: {
      orderBy: [desc(transaction.date)],
      limit: 10,
    },
  },
});

// With soft delete filtering
import { isNull } from "drizzle-orm";
const activeTransactions = await db.query.transaction.findMany({
  where: and(
    eq(transaction.workspaceId, workspaceId),
    isNull(transaction.deletedAt)
  ),
});
```

### Server Component with tRPC

```typescript
import { createCaller } from "@/server/api/root";
import { auth } from "@/server/better-auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const trpc = createCaller({ db, session });

  if (!session?.user) {
    redirect("/login");
  }

  const workspaces = await trpc.workspace.getWorkspaces();

  return <div>{/* render */}</div>;
}
```

### Client Component with tRPC

```typescript
"use client";

import { api } from "@/trpc/react";

export function TransactionList({ workspaceId }: { workspaceId: string }) {
  const { data: transactions, isLoading } = api.transaction.getByWorkspace.useQuery({ workspaceId });

  if (isLoading) return <div>Loading...</div>;

  return <div>{/* render */}</div>;
}
```

## TypeScript Notes

- Strict mode enabled with `noUncheckedIndexedAccess` (array access returns `T | undefined`)
- Use `zod` for runtime validation
- Drizzle numeric types return as strings, parse with `parseFloat()` or use Drizzle ORM helpers
- Server-only code: Import `server-only` to ensure code doesn't bundle to client

## Testing PWA Features

PWA functionality requires production build:

```bash
pnpm build
pnpm start
# Open http://localhost:3000 in Chrome
# DevTools > Application > Service Workers
# DevTools > Lighthouse > Run PWA audit
```

## Deployment Notes

- Database migrations must be applied before deployment
- Set `BETTER_AUTH_SECRET` in production
- Set `BETTER_AUTH_BASE_URL` to production domain
- PWA requires HTTPS (automatically handled by Vercel)
- Run `pnpm db:migrate` on production database after schema changes

## Development Tips

- Use `./start-database.sh` for local PostgreSQL (requires Docker or Podman)
- Service worker is disabled in dev mode for debugging convenience
- tRPC adds artificial delays (100-500ms) in dev mode to simulate network latency
- Use `pnpm db:studio` to inspect database visually
- Check `AGENT_CONTRACTS.md` for multi-agent coordination details
