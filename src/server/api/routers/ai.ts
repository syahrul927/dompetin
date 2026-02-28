import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { env } from "@/env";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

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
      })
    )
    .mutation(async ({ input }) => {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              success: { type: SchemaType.BOOLEAN },
              amount: { type: SchemaType.NUMBER, nullable: true },
              name: { type: SchemaType.STRING, nullable: true },
              date: { type: SchemaType.STRING, nullable: true, description: "Date in YYYY-MM-DD format" },
              type: { type: SchemaType.STRING, enum: ["expense", "income"], format: "enum" },
              notes: { type: SchemaType.STRING, nullable: true },
            },
            required: ["success", "amount", "name", "date", "type", "notes"],
          },
        },
      });

      const prompt = `You are a receipt parser for a personal finance app.
      Analyze this image of a receipt and extract the transaction details.
      Output strict JSON matching the required schema.
      If it is not a readable receipt, set success to false.
      `;

      try {
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: input.imageBase64,
              mimeType: input.mimeType,
            },
          },
        ]);

        const textResponse = result.response.text();
        const parsed = JSON.parse(textResponse);
        return receiptSchema.parse(parsed);
      } catch (error) {
        console.error("Gemini API error:", error);
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
