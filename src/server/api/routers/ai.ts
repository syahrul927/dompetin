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

      const systemPrompt = `You are a receipt parser for a personal finance app.
      Analyze the provided image of a receipt and extract the transaction details.
      Output strict JSON matching this exact schema:
      {
        "success": boolean,
        "amount": number | null,
        "name": string | null,
        "date": "YYYY-MM-DD" | null,
        "type": "expense" | "income",
        "notes": string | null
      }
      If it is not a readable receipt, set success to false.

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
          model: "llama-3.2-11b-vision-preview",
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
        availableWallets: z.array(z.object({ id: z.string(), name: z.string() })),
        availableCategories: z.array(z.object({ id: z.string(), name: z.string() })),
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
            { role: "user", content: userPrompt }
          ],
          model: "llama-3.1-8b-instant",
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
                { type: "text", text: "Please parse this receipt into individual items." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.imageBase64}`,
                  },
                },
              ],
            },
          ],
          model: "llama-3.2-11b-vision-preview",
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
});
