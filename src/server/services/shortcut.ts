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
  const nameLower = raw.name.toLowerCase();
  const walletById = wallets.find((w) => w.id === raw.walletId);
  const walletByName = walletById
    ? undefined
    : wallets.find(
        (w) =>
          raw.walletId != null &&
          (nameLower.includes(w.name.toLowerCase()) ||
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
