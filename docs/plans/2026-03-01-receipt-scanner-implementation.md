# Receipt Scanner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a receipt scanning feature that uses Gemini 1.5 Flash to extract transaction details from photos and pre-fills the "Add Transaction" form.

**Architecture:** Client-side image selection and compression -> Base64 string sent via tRPC `ai.scanReceipt` protected procedure -> Backend calls Gemini API with structured JSON schema -> Backend returns parsed JSON -> Client populates the Add Transaction form.

**Tech Stack:** Next.js App Router, tRPC, React Hook Form, `@google/generative-ai`, Zod, browser Canvas/FileReader APIs.

---

### Task 1: Environment & Dependencies Setup

**Files:**
- Modify: `package.json`
- Modify: `src/env.js`
- Modify: `.env.example`

**Step 1: Install Gemini SDK**
Run: `pnpm add @google/generative-ai`

**Step 2: Add Environment Variables**
Add `GEMINI_API_KEY` to `.env.example` and `src/env.js` (server-side string, required).

**Step 3: Commit**
```bash
git add package.json pnpm-lock.yaml src/env.js .env.example
git commit -m "build: add @google/generative-ai and GEMINI_API_KEY env var"
```

---

### Task 2: AI tRPC Router & Procedure

**Files:**
- Create: `src/server/api/routers/ai.ts`
- Modify: `src/server/api/root.ts`

**Step 1: Create the AI Router & Schema**
Create `ai.ts` with a `scanReceipt` protected procedure.
Input: `z.object({ imageBase64: z.string(), mimeType: z.string() })`
Output schema (for Gemini):
```typescript
const receiptSchema = z.object({
  success: z.boolean(),
  amount: z.number().nullable(),
  name: z.string().nullable(),
  date: z.string().nullable(), // YYYY-MM-DD
  type: z.enum(["expense", "income"]).default("expense"),
  notes: z.string().nullable()
});
```

**Step 2: Implement Gemini API Call**
Initialize `GoogleGenerativeAI(env.GEMINI_API_KEY)`. Use `gemini-1.5-flash`.
Pass the base64 image and a prompt requesting strict JSON matching the schema.
Parse the response and return it.

**Step 3: Connect to Root Router**
Add `ai: aiRouter` to `src/server/api/root.ts`.

**Step 4: Commit**
```bash
git add src/server/api/routers/ai.ts src/server/api/root.ts
git commit -m "feat(api): add scanReceipt tRPC procedure using Gemini 1.5 Flash"
```

---

### Task 3: Client-side Image Compression Utility

**Files:**
- Create: `src/lib/image.ts`

**Step 1: Implement compression utility**
Create a function `compressImage(file: File, maxWidth = 1000, quality = 0.8): Promise<string>` that:
1. Reads file via FileReader as DataURL.
2. Loads into an `Image` object.
3. Draws to a `<canvas>` scaling down to `maxWidth`.
4. Returns Base64 string via `canvas.toDataURL("image/jpeg", quality)`.
Strip the `data:image/jpeg;base64,` prefix before returning.

**Step 2: Commit**
```bash
git add src/lib/image.ts
git commit -m "feat(utils): add client-side image compression utility"
```

---

### Task 4: UI Integration (Receipt Scanner Button)

**Files:**
- Modify: The file containing the "Add Transaction" form/modal (likely `src/components/dashboard/TransactionForm.tsx` or similar).

**Step 1: Add Hidden File Input & Button**
Add a `<input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />`.
Add a "Scan Receipt" button (with a Camera/Scan icon) that triggers `fileInputRef.current.click()`.

**Step 2: Implement Upload & Scan Logic**
```typescript
const scanMutation = api.ai.scanReceipt.useMutation();
// On file change:
// 1. Set isScanning state to true.
// 2. Await compressImage(file).
// 3. scanMutation.mutateAsync({ imageBase64: compressed, mimeType: "image/jpeg" })
// 4. On success: populate react-hook-form using form.setValue() for amount, name, date, type, notes.
// 5. Set isScanning state to false.
```

**Step 3: Add Loading State**
While `isScanning` is true, show a loading overlay or change the button state to indicate processing. Handle mutation errors with a toast.

**Step 4: Commit**
```bash
git add <transaction-form-file>
git commit -m "feat(ui): add receipt scanner button and auto-fill logic"
```
