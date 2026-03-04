# Smart Transaction Input (Voice & Text) Design

## Goal
Implement a fast, AI-powered transaction entry system that supports native browser speech recognition (Web Speech API) and manual text input, using Groq API (Llama) for NLP parsing to automatically fill transaction details (amount, name, category, wallet, date).

## Context
The user wants to replace the single "Add Transaction" FAB action with an "Input Method" choice. This allows for rapid entry via voice ("makan siang 50rb pakai gopay") or text, centralizing all entry methods (Manual, Voice, Text, Scan Receipt) into one unified flow.

## Architecture

### 1. UI Components (Modular Drawers)

We will introduce a new modular drawer system triggered by the main Dashboard FAB to replace direct navigation to the `AddTransactionSheet`.

*   **`InputMethodDrawer`**: The new entry point.
    *   Triggered by the Dashboard FAB.
    *   Displays 4 distinct options:
        1.  **Manual**: Closes self, opens `AddTransactionSheet` (Step 1: Amount).
        2.  **Scan Struk**: Uses a Shadcn DropdownMenu (Camera/Gallery). Opens `AddTransactionSheet` (Step 2: Details) on success.
        3.  **Teks Cerdas (Smart Text)**: Closes self, opens `SmartTextDrawer`.
        4.  **Suara (Voice)**: Closes self, opens `VoiceInputDrawer`.

*   **`SmartTextDrawer`**:
    *   Contains a simple `Textarea` and a "Kirim" (Send) button.
    *   User types natural language transaction details.
    *   On "Kirim": Displays a loading state, calls `ai.parseTransactionText`, then closes and opens `AddTransactionSheet` (Step 2) pre-filled with the returned JSON.

*   **`VoiceInputDrawer`**:
    *   Contains a prominent microphone visualization/animation.
    *   Uses the browser's native `SpeechRecognition` API (`lang="id-ID"`).
    *   Automatically starts listening when opened.
    *   Displays live transcribed text as the user speaks.
    *   On "Kirim" (or automatic silence detection): Stops listening, displays a loading state, calls `ai.parseTransactionText`, then closes and opens `AddTransactionSheet` (Step 2) pre-filled with the returned JSON.

*   **`AddTransactionSheet`**:
    *   Remove the "Scan Struk" button from Step 1, as it now lives in the `InputMethodDrawer`.
    *   Ensure it correctly accepts incoming `walletId` and `categoryId` from the `initialData` prop.

### 2. Backend API (tRPC + Groq)

We will add a new mutation to `src/server/api/routers/ai.ts`.

*   **Endpoint**: `ai.parseTransactionText`
*   **Input**:
    *   `text` (string): The natural language input (e.g., "Makan siang 50rb pakai gopay").
    *   `availableWallets`: Array of `{ id, name }`.
    *   `availableCategories`: Array of `{ id, name }`.
*   **Prompt Logic**:
    *   Instruct the Groq LLM (`meta-llama/llama-4-scout-17b-16e-instruct` or similar) to act as an NLP parser.
    *   Provide the `text`, `availableWallets`, and `availableCategories`.
    *   Instruct the LLM to map spoken words (e.g., "gopay") to the provided `walletId`, and inferred categories (e.g., "makan" -> "Food" category ID).
    *   Convert spoken numbers ("lima puluh ribu") to integers (`50000`).
*   **Output Schema (Strict JSON)**:
    ```json
    {
      "success": boolean,
      "amount": number | null,
      "name": string | null,
      "date": "YYYY-MM-DD" | null,
      "type": "expense" | "income" | "transfer",
      "walletId": string | null,
      "categoryId": string | null,
      "notes": string | null
    }
    ```

## Trade-offs & Considerations
*   **Web Speech API Support**: Not 100% supported in all older browsers, and implementations vary (Chrome uses cloud, some use local). Fallback to standard manual input if the API is entirely missing from `window`.
*   **Groq Parsing**: LLMs can hallucinate ID mappings. The prompt must strictly enforce returning *only* IDs from the provided lists, or `null` if no match is found. The UI must gracefully handle `null` by letting the user pick manually in Step 2.