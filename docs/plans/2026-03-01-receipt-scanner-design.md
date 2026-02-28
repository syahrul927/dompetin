# Receipt Scanner Design

## Overview
A new feature allowing users to add transactions by snapping or uploading a photo of a receipt. The app uses Google Gemini 1.5 Flash to extract transaction details and pre-fill the transaction creation form for user review, saving time on manual entry.

## 1. User Interface (Client)
*   **Trigger:** Add a "Scan Receipt" button (an icon next to the "Add Transaction" button or inside a dropdown).
*   **Capture:** Clicking opens the native file picker configured for `image/*` and `capture="environment"` (optimizing for mobile cameras).
*   **Processing State:** Show a loading indicator ("Scanning receipt...") while the image is being processed.
*   **Compression:** Before sending, the client resizes and compresses the image (e.g., max width 1000px, JPEG quality 0.8) using browser APIs. This keeps the Base64 string small (< 1MB) to reduce tRPC payload size and AI token costs.
*   **Review Flow:** Once the AI returns the data, open the standard "Add Transaction" modal/drawer, pre-filled with the extracted data. The user reviews, corrects if necessary, and saves. This "human-in-the-loop" approach is safest.

## 2. API & AI Integration (Backend)
*   **AI Provider:** Google Gemini 1.5 Flash (via `@google/genai` or `@google/generative-ai` SDK). Chosen for its generous free tier (15 RPM, 1M TPM), high speed, and excellent multimodal capabilities.
*   **tRPC Endpoint:** Create a new `protectedProcedure` (e.g., `scanReceipt` in a new `ai.ts` router or existing `transaction.ts`).
*   **Input:** Accepts the Base64 image string and MIME type.
*   **Prompt Strategy:** Instruct the LLM to act as a receipt parser for a personal finance app. Require strict JSON output matching a specific Zod schema:
    *   `amount`: Total amount (number).
    *   `name`: Merchant name or brief description (string).
    *   `date`: Date of the transaction (ISO string or YYYY-MM-DD format).
    *   `type`: Usually "expense" (enum).
    *   `notes`: Extra details or line items found (string).
    *   `success`: Boolean indicating if a receipt was successfully read.
*   **Parsing:** The backend parses the LLM's JSON response, validates it against the expected schema, and returns it to the client.

## 3. Error Handling
*   **Invalid Image:** Handle cases where the image is too blurry, not a receipt, or unreadable using the `success` flag from the AI.
*   **API Limits:** Handle rate limiting from the AI provider gracefully (returning a standard tRPC error).
*   **Fallback:** If scanning fails, inform the user via a toast and fallback to the blank manual entry form.

## 4. Dependencies & Environment
*   **Package:** Install the Gemini SDK (`@google/generative-ai` or `@google/genai`).
*   **Environment:** Add `GEMINI_API_KEY` to `.env` and configure it in `src/env.js` as a server-side required variable.