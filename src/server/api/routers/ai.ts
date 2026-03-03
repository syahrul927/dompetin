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

      const prompt = `You are a receipt parser for a personal finance app.
      Analyze this image of a receipt and extract the transaction details.
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
      Total - Rp 33.500

      IMPORTANT: Output ONLY valid JSON, without any markdown formatting, backticks, or explanation.`;

      try {
        const result = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
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
        });

        const textResponse = result.choices[0]?.message?.content || "";
        // Clean up markdown block if the model included it despite our prompt
        const cleanedText = textResponse
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const parsed = JSON.parse(cleanedText);
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
});
