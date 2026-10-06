# Expense Webhook Shortcut API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public `POST /api/shortcut/expense` endpoint that authenticates with a per-user-per-workspace secret key, parses raw OCR bank-screenshot text via Groq, auto-creates an expense transaction, and returns a PWA deep-link URL to the transaction summary drawer.

**Architecture:** New `dompetin_webhook` table stores sha256-hashed keys. A Next.js route handler (outside tRPC session auth) verifies the key, rate-limits, loads workspace wallets/categories, calls a dedicated Groq parsing service, validates + falls back unknown IDs, inserts the transaction, and returns JSON with a `/transactions?tx=` deep link. A new tRPC `webhook` router + workspace settings UI manage key lifecycle.

**Tech Stack:** Next.js App Router route handler, Drizzle ORM (Postgres), tRPC, Groq SDK (`openai/gpt-oss-120b` — validated live against the user's real OCR samples; the previously used `meta-llama/llama-4-scout-17b-16e-instruct` has been retired by Groq and no longer exists on the account), vitest (new, for pure-logic unit tests).

**Spec:** `docs/superpowers/specs/2026-10-06-expense-webhook-shortcut-design.md`

**⚠️ Migration rule:** Only run `pnpm db:generate` (creates SQL files). NEVER run `pnpm db:push` or `pnpm db:migrate` — the human applies migrations manually. Task 1 ends with a note for the human.

**Test note:** The project has no test framework. Task 2 adds vitest for pure-logic units (key hashing, prompt building, result validation). Route-handler end-to-end verification is manual (Task 9) with the user's real OCR samples.

---

### Task 1: Schema — `dompetin_webhook` table

**Files:**
- Modify: `src/server/db/dompetin-schema.ts`

- [ ] **Step 1: Add the table definition**

Add after the `invitation` table (before the `wallet` table, ~line 158), keeping the file's existing style:

```typescript
// Webhook integrations (per user per workspace, e.g. iOS Shortcut)
export const webhook = pgTable(
  "dompetin_webhook",
  {
    id: uuidColumn("id").primaryKey().defaultRandom(),
    workspaceId: uuidColumn("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("webhook_key_hash_idx").on(table.keyHash)],
);
```

Check the top of the file imports `uniqueIndex` from `drizzle-orm/pg-core` (same import block as `pgTable`, `uuidColumn`, etc.); add it if missing.

- [ ] **Step 2: Generate the migration SQL**

Run: `pnpm db:generate`
Expected: a new SQL file under `drizzle/` creating `dompetin_webhook` with the unique index on `key_hash`.

- [ ] **Step 3: Ask the human to apply the migration**

Tell the user: "Migration generated. Please run `pnpm db:migrate` (or `pnpm db:push`) yourself." Do NOT run either command. Implementation of later tasks can proceed in parallel; only runtime verification (Task 9) needs the table to exist.

- [ ] **Step 4: Commit**

```bash
git add src/server/db/dompetin-schema.ts drizzle/
git commit -m "feat(webhook): add dompetin_webhook table schema"
```

---

### Task 2: Vitest setup + secret key helpers

**Files:**
- Modify: `package.json` (add script)
- Create: `vitest.config.ts`
- Create: `src/server/lib/shortcut-key.ts`
- Test: `src/server/lib/shortcut-key.test.ts`

- [ ] **Step 1: Install vitest and add the test script**

Run: `pnpm add -D vitest`

In `package.json` scripts, add:

```json
"test": "vitest run"
```

- [ ] **Step 2: Create `vitest.config.ts`** (project root, next to `package.json`)

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `src/server/lib/shortcut-key.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateShortcutKey, hashShortcutKey } from "./shortcut-key";

describe("generateShortcutKey", () => {
  it("returns a dpt_-prefixed 64-char hex key", () => {
    const key = generateShortcutKey();
    expect(key).toMatch(/^dpt_[0-9a-f]{64}$/);
  });

  it("returns a unique key each call", () => {
    expect(generateShortcutKey()).not.toBe(generateShortcutKey());
  });
});

describe("hashShortcutKey", () => {
  it("produces a stable sha256 hex digest", () => {
    expect(hashShortcutKey("dpt_abc")).toHaveLength(64);
    expect(hashShortcutKey("dpt_abc")).toBe(hashShortcutKey("dpt_abc"));
    expect(hashShortcutKey("dpt_abc")).not.toBe(hashShortcutKey("dpt_abd"));
  });

  it("hashes a generated key to something different from the key", () => {
    const key = generateShortcutKey();
    expect(hashShortcutKey(key)).not.toBe(key);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./shortcut-key`.

- [ ] **Step 5: Implement the helpers**

Create `src/server/lib/shortcut-key.ts`:

```typescript
import { createHash, randomBytes } from "crypto";

/**
 * Webhook secret keys look like `dpt_<64 hex chars>` (32 random bytes).
 * Only the sha256 hash is persisted; the plain key is shown once at creation.
 */
export function generateShortcutKey(): string {
  return `dpt_${randomBytes(32).toString("hex")}`;
}

export function hashShortcutKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/server/lib/shortcut-key.ts src/server/lib/shortcut-key.test.ts
git commit -m "feat(webhook): add secret key generation/hashing with vitest setup"
```

---

### Task 3: AI parsing service — prompt builder + result validator

**Files:**
- Create: `src/server/services/shortcut.ts`
- Test: `src/server/services/shortcut.test.ts`

This file stays free of `env`/Groq imports so it is unit-testable. The route handler (Task 5) owns the Groq client and calls `parseExpenseMessage`.

- [ ] **Step 1: Write the failing test**

Create `src/server/services/shortcut.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildShortcutPrompt,
  validateShortcutResult,
} from "./shortcut";

const wallets = [
  { id: "w-blu", name: "blu BCA", type: "bank" },
  { id: "w-mandiri", name: "Livin Mandiri", type: "bank" },
  { id: "w-cash", name: "Cash", type: "cash" },
];

const categories = [
  { id: "default:belanja", name: "Belanja" },
  { id: "default:lainnya-expense", name: "Lainnya" },
  { id: "c-hobby", name: "Hobby" },
];

describe("buildShortcutPrompt", () => {
  it("includes wallet names/ids and category names/ids in the prompt", () => {
    const prompt = buildShortcutPrompt(wallets, categories);
    expect(prompt).toContain("blu BCA");
    expect(prompt).toContain("w-blu");
    expect(prompt).toContain("default:belanja");
    expect(prompt).toContain("Hobby");
  });

  it("contains the Indonesian number-format and IDR-total rules", () => {
    const prompt = buildShortcutPrompt(wallets, categories);
    expect(prompt).toContain("thousand");
    expect(prompt).toContain("IDR");
    expect(prompt).toContain("walletId");
    expect(prompt).toContain("categoryId");
  });
});

describe("validateShortcutResult", () => {
  const today = "2026-10-06";

  it("accepts known wallet/category ids", () => {
    const result = validateShortcutResult(
      {
        name: "RUNPOD.IO",
        amount: 362304,
        date: "2026-09-20",
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "ref 0920",
      },
      wallets,
      categories,
      today,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        name: "RUNPOD.IO",
        amount: 362304,
        date: "2026-09-20",
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "ref 0920",
      },
    });
  });

  it("falls back to first wallet when walletId is unknown", () => {
    const result = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "2026-09-20",
        walletId: "w-unknown",
        categoryId: "default:belanja",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.walletId).toBe("w-blu");
  });

  it("falls back to lainnya category when categoryId is unknown", () => {
    const result = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "2026-09-20",
        walletId: "w-blu",
        categoryId: "c-nope",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.categoryId).toBe("default:lainnya-expense");
  });

  it("uses today when date is missing or unparseable", () => {
    const bad = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "garbage",
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(bad.value.date).toBe(today);

    const missing = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: null,
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    if (missing.ok) expect(missing.value.date).toBe(today);
  });

  it("returns ok:false when name/amount are missing or amount is not positive", () => {
    expect(
      validateShortcutResult(
        { name: null, amount: 100, date: null, walletId: "w-blu", categoryId: null, notes: "" },
        wallets,
        categories,
        today,
      ).ok,
    ).toBe(false);
    expect(
      validateShortcutResult(
        { name: "X", amount: 0, date: null, walletId: "w-blu", categoryId: null, notes: "" },
        wallets,
        categories,
        today,
      ).ok,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./shortcut`.

- [ ] **Step 3: Implement the service**

Create `src/server/services/shortcut.ts`:

```typescript
import { z } from "zod";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

export interface ShortcutWallet {
  id: string;
  name: string;
  type: string;
}

export interface ShortcutCategory {
  id: string;
  name: string;
}

const shortcutResultSchema = z.object({
  name: z.string().nullable(),
  amount: z.number().nullable(),
  date: z.string().nullable(),
  walletId: z.string().nullable(),
  categoryId: z.string().nullable(),
  notes: z.string().nullable(),
});

export type ShortcutAiResult = z.infer<typeof shortcutResultSchema>;

export interface ParsedShortcutTransaction {
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  walletId: string;
  categoryId: string;
  notes: string;
}

export function buildShortcutPrompt(
  wallets: ShortcutWallet[],
  categories: ShortcutCategory[],
): string {
  const walletList = wallets
    .map((w) => `- id: "${w.id}", name: "${w.name}", type: ${w.type}`)
    .join("\n");
  const categoryList = categories
    .map((c) => `- id: "${c.id}", name: "${c.name}"`)
    .join("\n");
  const lainnya =
    categories.find((c) => c.id === "default:lainnya-expense")?.id ??
    categories[0]?.id ??
    "";

  return `You are a transaction parser for an Indonesian personal finance app.
The user message is RAW OCR TEXT captured from a screenshot of an Indonesian bank or e-wallet app (blu BCA, Livin' by Mandiri, BCA, BRI, BNI, GoPay, OVO, DANA, ShopeePay, etc).

OCR text is noisy. IGNORE non-transaction noise: status bars ("18.31", ", 4G"), ad banners, promo text, UI buttons ("Beli sekarang", "Bagikan Resi", "Bayar Sekarang", "Lihat Resi"), icons, and layout fragments. Extract exactly ONE transaction: the money movement that happened.

Return strict JSON matching this exact schema:
{
  "name": string,          // merchant, recipient, or description (e.g. "RUNPOD.IO", "MOCHAMAD SOLEH")
  "amount": number,        // whole-number IDR, no decimals
  "date": "YYYY-MM-DD",
  "walletId": string,      // MUST be an id from the wallet list below
  "categoryId": string,    // MUST be an id from the category list below
  "notes": string          // reference numbers, recipient bank/account details, transaction type; "" if none
}

CRITICAL - Indonesian number format:
- Dots (.) are THOUSAND separators, not decimal points. "362.304" = 362304. "1.500.000" = 1500000.
- OCR often mangles decimals: "Rp 362.304:00" or "Rp 362.304,00" both mean 362304.
- Convert spoken/abbreviated forms too: "50rb" = 50000.

Currency:
- If a USD nominal is shown alongside an IDR total (e.g. "Nominal dalam USD $20,00" plus "Total Bayar Rp 362.304"), ALWAYS use the IDR total as the amount.

Date:
- Parse from formats like "20 Sep 2026 | 08:32:24 WIB" or "31 Agu 2026". Indonesian months: Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des.
- If no date is visible, use "${new Date().toISOString().slice(0, 10)}".

walletId - you MUST pick the closest match (never null). Match the issuing bank/e-wallet shown in the text ("From Blu BCA Digital", "Mandiri") against the wallet names:
${walletList}

categoryId - you MUST pick the best-fit category (never null). If nothing fits well, use "${lainnya}":
${categoryList}

This endpoint is used for EXPENSES only. Interpret the transaction as money going out.
If the text contains no recognizable transaction at all, return:
{ "name": null, "amount": null, "date": null, "walletId": null, "categoryId": null, "notes": null }`;
}

/**
 * Validate the AI result against the actual workspace wallets/categories and
 * apply fallbacks. Transaction is created whenever name+amount are usable —
 * unknown wallet falls back to the first wallet, unknown category to lainnya.
 */
export function validateShortcutResult(
  parsed: unknown,
  wallets: ShortcutWallet[],
  categories: ShortcutCategory[],
  today: string,
): { ok: true; value: ParsedShortcutTransaction } | { ok: false } {
  const result = shortcutResultSchema.safeParse(parsed);
  if (!result.success) return { ok: false };
  const raw = result.data;

  const amount = raw.amount;
  if (!raw.name || !amount || amount <= 0) return { ok: false };

  // Date: keep valid YYYY-MM-DD, else today
  const date =
    raw.date && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : today;

  // Wallet: exact id, else closest name substring, else first wallet
  const walletById = wallets.find((w) => w.id === raw.walletId);
  const walletByName = walletById
    ? undefined
    : wallets.find(
        (w) =>
          raw.walletId != null &&
          (raw.name.toLowerCase().includes(w.name.toLowerCase()) ||
            w.name.toLowerCase().includes(raw.walletId.toLowerCase())),
      );
  const wallet = walletById ?? walletByName ?? wallets[0];

  // Category: exact id, else lainnya (or first category)
  const category = categories.find((c) => c.id === raw.categoryId);
  const fallbackCategory =
    categories.find((c) => c.id === "default:lainnya-expense") ??
    categories[0];

  if (!wallet || !fallbackCategory) return { ok: false };

  return {
    ok: true,
    value: {
      name: raw.name,
      amount: Math.round(amount),
      date,
      walletId: wallet.id,
      categoryId: (category ?? fallbackCategory).id,
      notes: raw.notes ?? "",
    },
  };
}

/**
 * Call Groq with the shortcut prompt. The Groq client is injected by the
 * caller (route handler) so this module stays free of env imports.
 */
export async function parseExpenseMessage(
  groq: { chat: { completions: { create: (opts: unknown) => Promise<{ choices: { message?: { content?: string } }[] }> } } },
  text: string,
  wallets: ShortcutWallet[],
  categories: ShortcutCategory[],
): Promise<ParsedShortcutTransaction | null> {
  const result = await groq.chat.completions.create({
    messages: [
      { role: "system", content: buildShortcutPrompt(wallets, categories) },
      { role: "user", content: text },
    ],
    model: "openai/gpt-oss-120b",
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const content = result.choices[0]?.message?.content ?? "";
  const today = new Date().toISOString().slice(0, 10);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return null;
  }
  const validated = validateShortcutResult(parsedJson, wallets, categories, today);
  return validated.ok ? validated.value : null;
}

// Re-export so the route handler can build the category list without
// importing from two places.
export { DEFAULT_CATEGORIES };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/shortcut.ts src/server/services/shortcut.test.ts
git commit -m "feat(webhook): Groq OCR parsing service with prompt builder and validation fallbacks"
```

---

### Task 4: In-memory rate limiter

**Files:**
- Create: `src/server/lib/rate-limit.ts`
- Test: `src/server/lib/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/lib/rate-limit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("allows requests under the limit and blocks past it", () => {
    const key = "k1";
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(key, 30, 3600_000)).toBe(true);
    }
    expect(checkRateLimit(key, 30, 3600_000)).toBe(false);
    // other keys unaffected
    expect(checkRateLimit("k2", 30, 3600_000)).toBe(true);
  });

  it("resets after the window passes", () => {
    vi.useFakeTimers();
    const key = "k3";
    for (let i = 0; i < 30; i++) checkRateLimit(key, 30, 1000);
    expect(checkRateLimit(key, 30, 1000)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, 30, 1000)).toBe(true);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./rate-limit`.

- [ ] **Step 3: Implement**

Create `src/server/lib/rate-limit.ts`:

```typescript
/**
 * Simple in-memory sliding-window rate limiter.
 * Known limitation: per server instance (serverless = per warm lambda).
 * Upgrade path if needed: DB-backed counter keyed by key hash.
 */
const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  hits.set(key, timestamps);
  return true;
}

export function resetRateLimit(): void {
  hits.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/lib/rate-limit.ts src/server/lib/rate-limit.test.ts
git commit -m "feat(webhook): in-memory sliding-window rate limiter"
```

---

### Task 5: Route handler — `POST /api/shortcut/expense`

**Files:**
- Create: `src/app/api/shortcut/expense/route.ts`

- [ ] **Step 1: Implement the handler**

Create `src/app/api/shortcut/expense/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import Groq from "groq-sdk";
import { db } from "@/server/db";
import { webhook, wallet, category, transaction } from "@/server/db/schema";
import { env } from "@/env";
import { hashShortcutKey } from "@/server/lib/shortcut-key";
import { checkRateLimit } from "@/server/lib/rate-limit";
import {
  parseExpenseMessage,
  validateShortcutResult,
  buildShortcutPrompt,
  DEFAULT_CATEGORIES,
  type ShortcutCategory,
} from "@/server/services/shortcut";

const MAX_MESSAGE_LENGTH = 4000;

function errorResponse(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  // 1. Authenticate by secret key
  const key = request.headers.get("secret-key");
  if (!key) return errorResponse(401, "Missing secret-key header");

  const keyHash = hashShortcutKey(key);
  const webhookRow = await db.query.webhook.findFirst({
    where: eq(webhook.keyHash, keyHash),
  });
  if (!webhookRow) return errorResponse(401, "Invalid secret key");

  // 2. Rate limit per key
  if (!checkRateLimit(keyHash, 30, 60 * 60 * 1000)) {
    return errorResponse(429, "Rate limit exceeded. Max 30 requests/hour.");
  }

  // Update lastUsedAt (fire and forget)
  void db
    .update(webhook)
    .set({ lastUsedAt: new Date() })
    .where(eq(webhook.id, webhookRow.id));

  // 3. Validate body
  let message: string;
  try {
    const body = (await request.json()) as { message?: unknown };
    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return errorResponse(400, 'Body must be JSON with a non-empty "message" string');
    }
    if (body.message.length > MAX_MESSAGE_LENGTH) {
      return errorResponse(400, `Message exceeds ${MAX_MESSAGE_LENGTH} characters`);
    }
    message = body.message;
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  // 4. Load wallets + expense categories for the workspace
  const workspaceId = webhookRow.workspaceId;
  const wallets = await db.query.wallet.findMany({
    where: and(eq(wallet.workspaceId, workspaceId), eq(wallet.isArchived, false)),
    columns: { id: true, name: true, type: true },
    orderBy: wallet.createdAt,
  });
  if (wallets.length === 0) {
    return errorResponse(422, "Workspace has no wallets configured");
  }

  const dbCategories = await db.query.category.findMany({
    where: and(eq(category.workspaceId, workspaceId), eq(category.type, "expense")),
    columns: { id: true, name: true },
  });
  // Merge default categories (not yet in DB) using the "default:" prefix ids,
  // same convention as category.getCategories
  const dbNameSet = new Set(dbCategories.map((c) => c.name));
  const defaultCategories: ShortcutCategory[] = DEFAULT_CATEGORIES.filter(
    (d) => d.type === "expense" && !dbNameSet.has(d.name),
  ).map((d) => ({ id: `default:${d.key}`, name: d.name }));
  const categories: ShortcutCategory[] = [...defaultCategories, ...dbCategories];

  // 5. Parse via Groq
  const groq = new Groq({ apiKey: env.GROQ_API_KEY });
  let parsed;
  try {
    parsed = await parseExpenseMessage(groq, message, wallets, categories);
  } catch (e) {
    console.error("Shortcut Groq error:", e);
    return errorResponse(422, "Failed to process message");
  }
  if (!parsed) return errorResponse(422, "No transaction detected in message");

  // 6. Resolve "default:" category ids to real DB uuids (lazy-create),
  //    mirroring category.resolveCategory
  let categoryId = parsed.categoryId;
  if (categoryId.startsWith("default:")) {
    const keyPart = categoryId.replace("default:", "");
    const def = DEFAULT_CATEGORIES.find((d) => d.key === keyPart);
    if (def) {
      const existing = await db.query.category.findFirst({
        where: and(
          eq(category.workspaceId, workspaceId),
          eq(category.name, def.name),
          eq(category.type, def.type),
        ),
        columns: { id: true },
      });
      if (existing) {
        categoryId = existing.id;
      } else {
        const [created] = await db
          .insert(category)
          .values({
            name: def.name,
            icon: def.icon,
            type: def.type,
            color: def.color,
            isSystem: true,
            workspaceId,
            userId: webhookRow.userId,
          })
          .returning({ id: category.id });
        categoryId = created!.id;
      }
    }
  }

  // 7. Create the expense transaction
  const [created] = await db
    .insert(transaction)
    .values({
      type: "expense",
      amount: parsed.amount.toString(),
      name: parsed.name,
      notes: parsed.notes || null,
      date: new Date(`${parsed.date}T00:00:00Z`),
      categoryId,
      walletId: parsed.walletId,
      workspaceId,
      createdBy: webhookRow.userId,
    })
    .returning({ id: transaction.id });

  const createdTx = created!;

  // 8. Build deep-link URL from request origin
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const url = `${origin}/transactions?tx=${createdTx.id}`;

  const walletRow = wallets.find((w) => w.id === parsed.walletId);

  return NextResponse.json(
    {
      success: true,
      transaction: {
        id: createdTx.id,
        name: parsed.name,
        amount: parsed.amount,
        date: parsed.date,
        walletId: parsed.walletId,
        walletName: walletRow?.name ?? null,
        categoryId: parsed.categoryId,
        categoryName:
          categories.find((c) => c.id === parsed.categoryId)?.name ?? null,
      },
      url,
    },
    { status: 201 },
  );
}
```

Note: `validateShortcutResult` / `buildShortcutPrompt` imports are unused in this file after `parseExpenseMessage` does the validation internally — remove them from the import list if the linter flags them (keep `parseExpenseMessage`, `DEFAULT_CATEGORIES`, `type ShortcutCategory`).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck` (or `npx tsc --noEmit` if no script exists)
Expected: no new errors in the touched files.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shortcut/expense/route.ts
git commit -m "feat(webhook): POST /api/shortcut/expense route handler"
```

---

### Task 6: tRPC `webhook` router

**Files:**
- Create: `src/server/api/routers/webhook.ts`
- Modify: `src/server/api/root.ts` (import + register)

Note: routers in this codebase are plain objects of procedures (see `workspace.ts`), registered in `createTRPCRouter({...})` in `root.ts`. Membership check matches the existing pattern (`throw new Error("Access denied")`).

- [ ] **Step 1: Implement the router**

Create `src/server/api/routers/webhook.ts`:

```typescript
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
```

- [ ] **Step 2: Register in root**

In `src/server/api/root.ts`, add the import next to the others:

```typescript
import { webhookRouter } from "./routers/webhook";
```

and register after the split bill entry inside `createTRPCRouter({...})`:

```typescript
  /**
   * Webhook integration router
   */
  webhook: webhookRouter,
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck` (or `npx tsc --noEmit`)
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/api/routers/webhook.ts src/server/api/root.ts
git commit -m "feat(webhook): tRPC webhook router (create/list/regenerate/revoke)"
```

---

### Task 7: Deep link — `/transactions?tx=` opens summary drawer

**Files:**
- Modify: `src/app/transactions/page.tsx`

Behavior: on mount, if `?tx=<id>` is present, fetch that transaction and open the **summary drawer** (`TransactionActionSheet`) — same as tapping a row manually. Edit still goes through the sheet's Edit button.

- [ ] **Step 1: Add param-driven drawer opening**

In `src/app/transactions/page.tsx`:

1. Add imports:

```typescript
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
```

(change the existing `import React, { useState } from "react";` to `import React, { useEffect, useState } from "react";`)

2. Inside `TransactionsPage`, after the `editTx` state, add:

```typescript
const searchParams = useSearchParams();
const deepLinkTxId = searchParams.get("tx");

// Deep link: /transactions?tx=<id> opens the summary drawer for that transaction
const { data: deepLinkTx } = api.transaction.getTransaction.useQuery(
  { id: deepLinkTxId! },
  { enabled: !!deepLinkTxId },
);

useEffect(() => {
  if (!deepLinkTxId || !deepLinkTx) return;
  const tx = deepLinkTx as unknown as Parameters<typeof getWalletContext>[1] extends never ? never : Record<string, unknown>;
  const amount = Math.abs(parseFloat(String(tx.amount)));
  const type =
    tx.type === "transfer"
      ? parseFloat(String(tx.amount)) < 0
        ? "transfer_debit"
        : "transfer_credit"
      : (tx.type as string);
  setActionTx({
    id: tx.id,
    name: tx.name,
    category: (tx as { category?: { name?: string } }).category?.name ?? "Lainnya",
    categoryIcon: (tx as { category?: { icon?: string } }).category?.icon,
    categoryColor: (tx as { category?: { color?: string } }).category?.color,
    date: formatTransactionDate(tx.date as string | Date),
    rawDate: new Date(tx.date as string | Date),
    amount,
    type,
    walletContext: getWalletContext(
      tx.type as string,
      (tx as { wallet?: unknown }).wallet,
      (tx as { toWallet?: unknown }).toWallet,
    ),
    authorName: (tx as { createdBy?: { name?: string } }).createdBy?.name,
    createdBy: tx.createdBy,
    raw: tx,
  });
  // Clean the URL so refresh/back doesn't re-open the drawer
  window.history.replaceState(null, "", "/transactions");
}, [deepLinkTxId, deepLinkTx]);
```

If the cast-heavy shape fights the compiler, extract the existing inline mapping in `transformedTransactions.map(...)` into a local `function transformTransaction(tx: ...) { ... }` and call it from both places — preferred if types allow; keep the code above only as the fallback shape. Match whatever typing `api.transaction.getTransaction` returns.

3. `useSearchParams` in a client page requires a `<Suspense>` boundary under Next.js App Router during static rendering. If the build errors with `useSearchParams() should be wrapped in a suspense boundary`, wrap the page body: rename the current component to `TransactionsPageContent` and export a default wrapper:

```typescript
export default function TransactionsPage() {
  return (
    <React.Suspense>
      <TransactionsPageContent />
    </React.Suspense>
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `pnpm build` (catches the Suspense requirement) then `pnpm dev`, log in, open `/transactions?tx=<some real id>` (grab an id from the transactions list via devtools/network or DB). 
Expected: the transaction summary drawer opens on load; URL becomes `/transactions`; Edit button opens the edit drawer.

- [ ] **Step 3: Commit**

```bash
git add src/app/transactions/page.tsx
git commit -m "feat(transactions): deep link ?tx= opens summary drawer"
```

---

### Task 8: Integrations UI — workspace settings

**Files:**
- Create: `src/app/workspace/integrations/page.tsx`
- Modify: `src/app/workspace/page.tsx` (add a link/menu entry to the new page)

Check `src/app/workspace/page.tsx` for the existing layout pattern (PageHeader usage, Card styles) and match it. Keep the page in Indonesian, matching the app's UI language.

- [ ] **Step 1: Create the integrations page**

Create `src/app/workspace/integrations/page.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/trpc/react";
import { Webhook, Copy, RefreshCw, Trash2, Plus, Check } from "lucide-react";

export default function IntegrationsPage() {
  const { workspaceId } = useActiveWorkspace();
  const apiUtils = api.useUtils();

  const { data: webhooks, isLoading } = api.webhook.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId },
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("iPhone Shortcut");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const createMutation = api.webhook.create.useMutation({
    onSuccess: (data) => {
      setShownKey(data.secretKey);
      setCreateOpen(false);
      void apiUtils.webhook.list.invalidate();
    },
    onError: (e) => alert(e.message),
  });
  const regenerateMutation = api.webhook.regenerate.useMutation({
    onSuccess: (data) => setShownKey(data.secretKey),
    onError: (e) => alert(e.message),
  });
  const revokeMutation = api.webhook.revoke.useMutation({
    onSuccess: () => void apiUtils.webhook.list.invalidate(),
    onError: (e) => alert(e.message),
  });

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const activeWebhook = webhooks?.[0];

  return (
    <>
      <PageHeader title="Integrasi Webhook" />
      <div className="px-5 pt-2 pb-24 space-y-4">
        <p className="text-sm text-muted-foreground">
          Kirim transaksi otomatis dari Shortcut iOS atau aplikasi lain lewat
          webhook. Satu webhook per pengguna per workspace.
        </p>

        {isLoading && <Skeleton className="h-20 w-full rounded-[20px]" />}

        {!isLoading && !activeWebhook && (
          <Card className="rounded-[20px] p-8 text-center bg-secondary/20 border-dashed">
            <p className="text-muted-foreground text-sm mb-4">
              Belum ada webhook untuk workspace ini.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} className="mr-2" /> Buat Webhook
            </Button>
          </Card>
        )}

        {!isLoading && activeWebhook && (
          <Card className="rounded-[20px] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[14px] bg-primary/10 flex items-center justify-center">
                <Webhook size={18} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{activeWebhook.name}</p>
                <p className="text-xs text-muted-foreground">
                  Dibuat{" "}
                  {new Date(activeWebhook.createdAt).toLocaleDateString("id-ID")}
                  {activeWebhook.lastUsedAt
                    ? ` · Terakhir dipakai ${new Date(activeWebhook.lastUsedAt).toLocaleString("id-ID")}`
                    : " · Belum pernah dipakai"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (
                    confirm("Regenerate key? Key lama akan berhenti bekerja.")
                  ) {
                    regenerateMutation.mutate({ id: activeWebhook.id });
                  }
                }}
              >
                <RefreshCw size={14} className="mr-1" /> Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive"
                onClick={() => {
                  if (confirm("Hapus webhook ini?")) {
                    revokeMutation.mutate({ id: activeWebhook.id });
                  }
                }}
              >
                <Trash2 size={14} className="mr-1" /> Hapus
              </Button>
            </div>
          </Card>
        )}

        {/* Key / URL shown once dialog */}
        <Dialog open={!!shownKey} onOpenChange={(o) => !o && setShownKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Simpan key sekarang</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-destructive">
              Key hanya ditampilkan sekali. Tidak bisa dilihat lagi setelah
              ditutup.
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-2 py-1.5">
                  POST /api/shortcut/expense
                </code>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-2 py-1.5">
                  {shownKey}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => shownKey && copy(shownKey, "key")}
                >
                  {copied === "key" ? (
                    <Check size={14} />
                  ) : (
                    <Copy size={14} />
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Webhook</DialogTitle>
            </DialogHeader>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama webhook"
            />
            <Button
              disabled={!name.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({ workspaceId: workspaceId!, name: name.trim() })
              }
            >
              Buat & Tampilkan Key
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
```

Add `import { Skeleton } from "@/components/ui/skeleton";` to the imports (used for the loading state). If `Dialog`/`Input`/`Button` components have different prop shapes in this codebase, adjust to match — check `src/components/ui/`.

- [ ] **Step 2: Link from the workspace page**

Open `src/app/workspace/page.tsx`, find the workspace management/settings area (where members/invitations UI lives), and add a link/row to `/workspace/integrations` (e.g. a `Link` row with the `Webhook` icon labeled "Integrasi Webhook"). Match the styling of the adjacent rows.

- [ ] **Step 3: Verify manually**

Run: `pnpm dev`, open workspace → Integrasi Webhook, create a webhook.
Expected: key dialog shows the `dpt_...` key once; list shows the integration; second create attempt errors with "already have a webhook".

- [ ] **Step 4: Commit**

```bash
git add src/app/workspace/integrations/page.tsx src/app/workspace/page.tsx
git commit -m "feat(webhook): integrations management UI in workspace settings"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only). Requires the human to have applied the migration from Task 1.

- [ ] **Step 1: Run the app**

Run: `pnpm dev`

- [ ] **Step 2: Full flow with curl**

Create a webhook in the UI, copy the key, then:

```bash
curl -X POST http://localhost:3000/api/shortcut/expense \
  -H "Content-Type: application/json" \
  -H "secret-key: <PASTE_KEY>" \
  -d '{"message": "From Blu BCA Digital 18.31 , 4G Belanja Pakai Garuda x bluDebit Card, Dapatkan GarudaMiles! Klik di sini untuk request kartunya X Transaksi Berhasil 20 Sep 2026 | 08:32:24 WIB Total Bayar Rp 362.304:00 RUNPOD.IO oluvirtual Card - .. ... 7530 Nominal dalam USD $20,00 Tipe Transaksi Debit Online Kategori Shopping 0 No. Ref blu 0920 9250 8462"}'
```

Expected: `201`, `amount: 362304` (IDR total, not the $20 USD), `walletName` = the blu wallet, `date: "2026-09-20"`, `url` ending in `/transactions?tx=...`.

- [ ] **Step 3: Second sample (Mandiri transfer)**

```bash
curl -X POST http://localhost:3000/api/shortcut/expense \
  -H "Content-Type: application/json" \
  -H "secret-key: <PASTE_KEY>" \
  -d '{"message": "From Mandiri 11.51 :... 4G X Transfer Berhasil! 31 Agu 2026 • 11:51:49 WIB Lihat Resi Makasih mang mobil Penerima MOCHAMAD SOLEH Bank Permata - 1211837353 Nominal Rp 300.000 dari SYAHRUL ATAUFIK Tujuan Transaksi Lainnya Bagikan Resi Simpan ke Daftar Pembayaran Berhasil! Jangan Lupa Ngopi Hari ini! Beli sekarang dan bayar pakai QRIS livin Bayar Sekarang"}'
```

Expected: `201`, `amount: 300000`, wallet = the Mandiri wallet.

- [ ] **Step 4: Deep link**

Open the `url` from step 2 in the browser (logged in).
Expected: `/transactions?tx=...` opens the app, summary drawer shows the new transaction; Edit opens the edit drawer.

- [ ] **Step 5: Error paths**

```bash
# bad key → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/shortcut/expense \
  -H "Content-Type: application/json" -H "secret-key: dpt_wrong" \
  -d '{"message":"test"}'
# → 401

# oversized body → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/shortcut/expense \
  -H "Content-Type: application/json" -H "secret-key: <KEY>" \
  -d "{\"message\":\"$(python3 -c "print('x'*4001)")\"}"
# → 400

# non-transaction message → 422
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/shortcut/expense \
  -H "Content-Type: application/json" -H "secret-key: <KEY>" \
  -d '{"message":"halo halo bandung"}'
# → 422
```

- [ ] **Step 6: Run full test suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all green.

- [ ] **Step 7: Final commit (if any fixes were needed)**

```bash
git status
# fix anything found, then:
git add -A && git commit -m "fix(webhook): e2e verification fixes"
```

---

## Self-Review Notes

- Spec coverage: table (T1), key mgmt (T2, T6), parsing service (T3), rate limit (T4), endpoint (T5), deep link (T7), UI (T8), testing (T2-T4 unit, T9 manual). ✔
- **Prompt validated live** against the real Groq API (user-approved) using `scripts/test-shortcut-prompt.mjs` with the user's two OCR samples + a junk sample. Both `openai/gpt-oss-120b` and `qwen/qwen3.8-27b` returned perfect results on all three. Model chosen: `openai/gpt-oss-120b`.
- **Known issue outside scope:** existing `src/server/api/routers/ai.ts` still uses the retired `meta-llama/llama-4-scout-17b-16e-instruct` for scanReceipt / parseTransactionText / scanReceiptItems / scanBankMutation — those features return the failure fallback at runtime. Fix separately.
- Category handling refinement over spec: AI may return `default:` virtual category ids, so Task 5 lazily resolves them to real DB uuids before insert (mirrors `category.resolveCategory`). Spec's "validate returned IDs" is implemented in `validateShortcutResult` (T3) + this resolution.
- Type consistency: `ShortcutWallet`/`ShortcutCategory`/`ParsedShortcutTransaction` used consistently across T3/T5; `webhook` table name matches T1/T5/T6.
- `orderBy: wallet.createdAt` in T5 orders fallback "first wallet" deterministically (oldest first). AI name-substring matching is a best-effort bonus on top of id matching; primary selection is the id the AI returns.
