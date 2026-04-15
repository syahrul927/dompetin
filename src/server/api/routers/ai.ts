import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { env } from "@/env";
import Groq from "groq-sdk";

const receiptSchema = z.object({
  success: z.boolean(),
  amount: z.number().nullable(),
  name: z.string().nullable(),
  date: z.string().nullable(), // YYYY-MM-DD
  type: z.enum(["expense", "income"]).default("expense"),
  notes: z.string().nullable(),
});

const textTransactionSchema = z.object({
  success: z.boolean(),
  amount: z.number().nullable(),
  name: z.string().nullable(),
  date: z.string().nullable(),
  type: z.enum(["expense", "income", "transfer"]).default("expense"),
  walletId: z.string().nullable(),
  categoryId: z.string().nullable(),
  notes: z.string().nullable(),
});

const receiptItemsSchema = z.object({
  success: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string(),
        qty: z.number(),
        price: z.number(),
      }),
    )
    .nullable(),
  tax: z.number().nullable(),
  discount: z.number().nullable(),
});

const bankMutationTransactionSchema = z.object({
  name: z.string(),
  amount: z.number(),
  date: z.string(),
  type: z.enum(["income", "expense"]),
  notes: z.string(),
});

const bankMutationSchema = z.object({
  success: z.boolean(),
  transactions: z.array(bankMutationTransactionSchema),
});

export const aiRouter = createTRPCRouter({
  scanReceipt: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const groq = new Groq({ apiKey: env.GROQ_API_KEY });

      const systemPrompt = `You are a receipt parser for an Indonesian personal finance app.
      Analyze the provided image of a receipt and extract the transaction details.
      Output strict JSON matching this exact schema:
      {
        "success": boolean,
        "amount": number | null,
        "name": string | null,
        "date": null,  // ALWAYS return null for date
        "type": "expense" | "income",
        "notes": string | null
      }
      If it is not a readable receipt, set success to false.

      CRITICAL - Indonesian Number Format:
      - Indonesian receipts use DOTS (.) as THOUSAND separators, NOT decimal points
      - Example: "72.000" means 72,000 (seventy-two thousand), NOT 72.0
      - Example: "1.500.000" means 1,500,000 (one million five hundred thousand)
      - When extracting the amount, REMOVE all dots and parse as whole number
      - Return the amount as a plain number (e.g., 72000, not 72000.00)

      IMPORTANT: For the "name" field, ALWAYS extract and return the merchant/store name from the receipt. This is a REQUIRED field - never return null for "name" if a valid receipt is detected. Common examples: "Indomaret", "Alfamart", "Starbucks", "McDonald's", or the store name printed prominently on the receipt.

      For the "notes" field, please generate a formatted multi-line list of all items purchased with their quantities and prices. Also include any tax, service charge, discount applied, subtotal, and total amount.
      Example format:
      1x Nasi Goreng - Rp 25.000
      2x Es Teh - Rp 10.000
      Subtotal - Rp 35.000
      Tax (10%) - Rp 3.500
      Discount - -Rp 5.000
      Total - Rp 33.500`;

      try {
        const result = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Please parse this receipt." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.imageBase64}`,
                  },
                },
              ],
            },
          ],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0,
          response_format: { type: "json_object" },
        });

        const textResponse = result.choices[0]?.message?.content || "";
        const parsed = JSON.parse(textResponse);
        return receiptSchema.parse(parsed);
      } catch (error) {
        console.error("Groq API error:", error);
        return {
          success: false,
          amount: null,
          name: null,
          date: null,
          type: "expense" as const,
          notes: "Failed to scan receipt",
        };
      }
    }),

  parseTransactionText: protectedProcedure
    .input(
      z.object({
        text: z.string().max(1000),
        availableWallets: z.array(
          z.object({ id: z.string(), name: z.string() }),
        ),
        availableCategories: z.array(
          z.object({ id: z.string(), name: z.string() }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const groq = new Groq({ apiKey: env.GROQ_API_KEY });

      const systemPrompt = `You are an NLP parser for an Indonesian personal finance app.
      Extract the transaction details and map them to the CLOSEST available wallet/category ID.
      Convert spoken numbers like "lima puluh ribu" or "50rb" to standard integer format (e.g., 50000).
      Return strict JSON matching this exact schema:
      {
        "success": boolean,
        "amount": number | null,
        "name": string | null,
        "date": "YYYY-MM-DD" | null,
        "type": "expense" | "income" | "transfer",
        "walletId": string | null, // MUST match an ID from the available list, or null
        "categoryId": string | null, // MUST match an ID from the available list, or null
        "notes": string | null
      }
      If the text is completely incomprehensible, set success to false.`;

      const userPrompt = `User input: "${input.text}"
      Available Wallets: ${JSON.stringify(input.availableWallets)}
      Available Categories: ${JSON.stringify(input.availableCategories)}`;

      try {
        const result = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0,
          response_format: { type: "json_object" },
        });

        const textResponse = result.choices[0]?.message?.content || "";
        const parsed = JSON.parse(textResponse);
        return textTransactionSchema.parse(parsed);
      } catch (error) {
        console.error("Groq Text Parse error:", error);
        return {
          success: false,
          amount: null,
          name: null,
          date: null,
          type: "expense" as const,
          walletId: null,
          categoryId: null,
          notes: "Gagal memproses teks.",
        };
      }
    }),

  scanReceiptItems: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const groq = new Groq({ apiKey: env.GROQ_API_KEY });

      const systemPrompt = `You are a receipt parser for a personal finance app.
    Analyze the provided image of a receipt and extract INDIVIDUAL LINE ITEMS.
    Output strict JSON matching this exact schema:
    {
      "success": boolean,
      "items": [{ "name": string, "qty": number, "price": number }] | null,
      "tax": number | null,
      "discount": number | null
    }

    Rules:
    - "price" is the price PER UNIT (not total for qty), in whole IDR (no decimals)
    - "qty" is the quantity of each item (default 1 if not specified)
    - "tax" is the total tax/service charge amount in whole IDR, or null if none
    - "discount" is the total discount amount as a POSITIVE number in whole IDR, or null if none
    - If it is not a readable receipt, set success to false and items to null`;

      try {
        const result = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Please parse this receipt into individual items.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.imageBase64}`,
                  },
                },
              ],
            },
          ],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0,
          response_format: { type: "json_object" },
        });

        const textResponse = result.choices[0]?.message?.content || "";
        const parsed = JSON.parse(textResponse);
        return receiptItemsSchema.parse(parsed);
      } catch (error) {
        console.error("Groq Receipt Items error:", error);
        return {
          success: false,
          items: null,
          tax: null,
          discount: null,
        };
      }
    }),

  scanBankMutation: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const groq = new Groq({ apiKey: env.GROQ_API_KEY });

      const systemPrompt = `You are a bank/e-wallet mutation statement parser for an Indonesian personal finance app.
Analyze the provided image of a bank or e-wallet mutation/history screenshot and extract ALL transaction rows.

You must output strict JSON matching this exact schema:
{
  "success": boolean,
  "transactions": [
    {
      "name": string,
      "amount": number,
      "date": "YYYY-MM-DD",
      "type": "income" | "expense",
      "notes": string
    }
  ]
}

RULES:
1. Extract EVERY transaction row visible in the image. Do NOT skip any rows.
2. "name": The merchant name, transfer sender/receiver, or description of the transaction.
3. "amount": The transaction amount as a WHOLE number in IDR (no decimals).

CRITICAL - Indonesian Number Format:
- Indonesian formats use DOTS (.) as THOUSAND separators, NOT decimal points.
- "72.000" means 72000, NOT 72.0.
- "1.500.000" means 1500000.
- Remove ALL dots from amounts before parsing.
- Comma (,) is used as decimal separator but for IDR amounts it is extremely rare. If you see "72.000,50" treat it as 72000.

4. "date": Parse the transaction date into YYYY-MM-DD format.
- Handle common Indonesian date formats: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY (Indonesian month names: Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des).
- If the year is not visible, assume the current year 2026.
- If the date cannot be parsed, use "2026-01-01".

5. "type": Determine based on these rules:
- CREDIT entries (money IN): incoming transfers (TRF MASUK, TRANSFER CR, top-up, received money) → "income"
- DEBIT entries (money OUT): payments, outgoing transfers (TRF KELUAR, TRANSFER DB, purchases, withdrawals) → "expense"
- Keywords for "income": CR, Credit, Masuk, Terima, Top Up, Refund, Cashback
- Keywords for "expense": DB, Debit, Keluar, Bayar, Beli, Pembayaran, Tarik, Transfer
- If ambiguous, default to "expense".

6. "notes": Include any additional details like reference numbers, transaction IDs, or remarks visible on the row. If none, use empty string "".

7. SKIP: header rows, "SALDO" / "BALANCE" rows, date-only rows with no transaction, and rows that are clearly not transactions.

8. The image may come from: BCA, BRI, Mandiri, BNI, CIMB, Permata, Danamon, GoPay, OVO, DANA, ShopeePay, LinkAja, or any other Indonesian bank/e-wallet app.

9. If the image is not a readable mutation/bank statement, set success to false and transactions to empty array.`;

      try {
        const result = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Please parse this bank/e-wallet mutation screenshot into individual transactions." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.imageBase64}`,
                  },
                },
              ],
            },
          ],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0,
          response_format: { type: "json_object" },
        });

        const textResponse = result.choices[0]?.message?.content || "";
        const parsed = JSON.parse(textResponse);
        const validated = bankMutationSchema.parse(parsed);

        if (!validated.success || validated.transactions.length === 0) {
          return {
            success: false as const,
            transactions: [],
            error: "Tidak ada transaksi terdeteksi dari gambar",
          };
        }

        return {
          success: true as const,
          transactions: validated.transactions,
        };
      } catch (error) {
        console.error("Groq Bank Mutation error:", error);
        return {
          success: false as const,
          transactions: [],
          error: "Gagal memindai mutasi rekening",
        };
      }
    }),
});
