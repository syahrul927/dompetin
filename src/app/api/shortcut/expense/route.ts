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
  const walletRows = await db.query.wallet.findMany({
    where: and(eq(wallet.workspaceId, workspaceId), eq(wallet.isArchived, false)),
    columns: { id: true, name: true, type: true },
    orderBy: wallet.createdAt,
  });
  if (walletRows.length === 0) {
    return errorResponse(422, "Workspace has no wallets configured");
  }
  const wallets = walletRows.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type, // narrowed enum, assignable to ShortcutWallet.type: string
  }));

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
    // The service takes a minimal structural client; Groq's overloaded
    // `create` isn't directly assignable, so adapt at the boundary.
    parsed = await parseExpenseMessage(
      groq as unknown as Parameters<typeof parseExpenseMessage>[0],
      message,
      wallets,
      categories,
    );
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
