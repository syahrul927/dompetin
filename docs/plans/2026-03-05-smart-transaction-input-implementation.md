# Smart Transaction Input (Voice & Text) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a fast, AI-powered transaction entry system that supports native browser speech recognition and manual text input to automatically fill transaction details.

**Architecture:** Create a new modular drawer system triggered by a main Dashboard FAB, replacing the direct navigation to `AddTransactionSheet`. Add an `InputMethodDrawer`, `SmartTextDrawer`, and `VoiceInputDrawer`. Create a new tRPC endpoint `ai.parseTransactionText` powered by Groq (Llama) to parse the natural language input.

**Tech Stack:** React, Next.js, Shadcn UI (Drawer, Textarea), Lucide Icons, Web Speech API, Groq SDK, tRPC, Zod

---

### Task 1: Create AI Parsing Endpoint (Backend)

**Files:**
- Modify: `src/server/api/routers/ai.ts`

**Step 1: Add new Zod schemas and endpoint**

Add a new schema for the parsed text response (similar to receipt but including wallet and category IDs) and add the `parseTransactionText` mutation to the `aiRouter`.

```typescript
// Add near receiptSchema in src/server/api/routers/ai.ts
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

// Inside aiRouter
  parseTransactionText: protectedProcedure
    .input(
      z.object({
        text: z.string(),
        availableWallets: z.array(z.object({ id: z.string(), name: z.string() })),
        availableCategories: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
    )
    .mutation(async ({ input }) => {
      const groq = new Groq({ apiKey: env.GROQ_API_KEY });

      const prompt = `You are an NLP parser for an Indonesian personal finance app.
      User input: "${input.text}"
      Available Wallets: ${JSON.stringify(input.availableWallets)}
      Available Categories: ${JSON.stringify(input.availableCategories)}

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
      If the text is completely incomprehensible, set success to false.
      IMPORTANT: Output ONLY valid JSON, without any markdown formatting, backticks, or explanation.`;

      try {
        const result = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "meta-llama/llama-4-scout-17b-16e-instruct", // Fast Groq model
          temperature: 0,
        });

        const textResponse = result.choices[0]?.message?.content || "";
        const cleanedText = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
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
```

**Step 2: Run typecheck**

Run: `pnpm check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/api/routers/ai.ts
git commit -m "feat(ai): add parseTransactionText endpoint for NLP"
```

---

### Task 2: Create Web Speech API Hook

**Files:**
- Create: `src/hooks/use-speech-recognition.ts`

**Step 1: Write custom hook**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Add missing types for browser speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "id-ID"; // Indonesian

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Prefer final, but show interim if speaking
      if (finalTranscript) {
         setTranscript((prev) => (prev + " " + finalTranscript).trim());
      } else if (interimTranscript) {
         // Optionally you could track interim separately,
         // but for simplicity we just append the latest result block
         // A common pattern is just tracking the whole block so far:
         const fullTranscript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join("");
         setTranscript(fullTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch(e) {}
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    setTranscript, // allow manual overrides if needed
    isSupported,
    startListening,
    stopListening
  };
}
```

**Step 2: Run linter/typecheck**

Run: `pnpm check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/use-speech-recognition.ts
git commit -m "feat(hooks): add useSpeechRecognition hook for web speech api"
```

---

### Task 3: Create AI Drawers (Text & Voice)

**Files:**
- Create: `src/components/transaction/SmartInputDrawer.tsx`

**Step 1: Create component for both Text and Voice modes**

Since both drawers are similar (they just collect a string and hit the API), we can build one flexible component `SmartInputDrawer.tsx` that accepts a `mode="text" | "voice"` prop.

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Send, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/trpc/react";
import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/use-analytics";

interface SmartInputDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "text" | "voice";
  onSuccess: (data: any) => void;
}

export function SmartInputDrawer({ open, onOpenChange, mode, onSuccess }: SmartInputDrawerProps) {
  const { workspaceId } = useActiveWorkspace();
  const { trackEvent } = useAnalytics();

  const [text, setText] = useState("");
  const { isListening, transcript, isSupported, startListening, stopListening } = useSpeechRecognition();

  // Queries to get IDs
  const { data: wallets } = api.wallet.getWallets.useQuery({ workspaceId }, { enabled: open && !!workspaceId });
  const { data: categories } = api.category.getCategories.useQuery({ workspaceId, type: "expense" }, { enabled: open && !!workspaceId });

  const parseMutation = api.ai.parseTransactionText.useMutation();

  // Sync transcript to text state when in voice mode
  useEffect(() => {
    if (mode === "voice" && transcript) {
      setText(transcript);
    }
  }, [transcript, mode]);

  // Auto-start listening in voice mode
  useEffect(() => {
    if (open && mode === "voice" && isSupported) {
      startListening();
    } else if (!open && isListening) {
      stopListening();
    }
  }, [open, mode, isSupported]); // excluded start/stop to avoid loops

  const handleSend = async () => {
    if (!text.trim() || parseMutation.isPending) return;

    if (isListening) stopListening();

    try {
      trackEvent("smart_input_initiated", { mode });

      const mappedWallets = wallets?.map(w => ({ id: w.id, name: w.name })) || [];
      const mappedCategories = categories?.map(c => ({ id: c.id, name: c.name })) || [];

      const result = await parseMutation.mutateAsync({
        text,
        availableWallets: mappedWallets,
        availableCategories: mappedCategories,
      });

      if (result.success) {
        trackEvent("smart_input_success", { mode });
        setText("");
        onSuccess(result);
      } else {
        alert(result.notes || "Gagal memproses data.");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem.");
    }
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[28px]">
        <DrawerHeader>
          <DrawerTitle>{mode === "voice" ? "Input Suara" : "Input Teks Cerdas"}</DrawerTitle>
        </DrawerHeader>
        <div className="p-5 pb-8 space-y-4">
          {!isSupported && mode === "voice" && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-xl">
              <AlertCircle size={16} />
              <span>Browser tidak mendukung fitur suara.</span>
            </div>
          )}

          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "voice" ? "Bicara sekarang..." : "Contoh: Makan siang 50rb pakai gopay"}
              className="min-h-32 rounded-2xl resize-none pb-12 text-base"
              disabled={parseMutation.isPending || (mode === "voice" && isListening)}
            />

            {mode === "voice" && isSupported && (
              <Button
                size="icon"
                variant={isListening ? "destructive" : "secondary"}
                className={cn("absolute bottom-3 left-3 rounded-full transition-all duration-300",
                  isListening && "animate-pulse scale-110 shadow-lg shadow-destructive/40"
                )}
                onClick={handleMicToggle}
                disabled={parseMutation.isPending}
              >
                <Mic size={18} />
              </Button>
            )}

            <Button
              size="icon"
              className="absolute bottom-3 right-3 rounded-full bg-primary"
              onClick={handleSend}
              disabled={!text.trim() || parseMutation.isPending}
            >
              {parseMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

**Step 2: Run linter/typecheck**

Run: `pnpm check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/transaction/SmartInputDrawer.tsx
git commit -m "feat(transaction): add smart input drawer for voice and text parsing"
```

---

### Task 4: Create Input Method Drawer

**Files:**
- Create: `src/components/transaction/InputMethodDrawer.tsx`

**Step 1: Create the router component**

This drawer acts as a router, opening the correct specific drawer based on the user's choice.

```tsx
"use client";

import React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PenLine, Mic, MessageSquare, ScanLine } from "lucide-react";

interface InputMethodDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: "manual" | "voice" | "text" | "scan") => void;
}

export function InputMethodDrawer({ open, onOpenChange, onSelectMethod }: InputMethodDrawerProps) {
  const handleSelect = (method: "manual" | "voice" | "text" | "scan") => {
    onOpenChange(false);
    // Slight delay to allow this drawer to close smoothly before opening the next
    setTimeout(() => onSelectMethod(method), 300);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[28px]">
        <DrawerHeader>
          <DrawerTitle className="text-center">Pilih Mode Input</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-2 gap-4 p-5 pb-8">
          <button
            onClick={() => handleSelect("manual")}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95"
          >
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <PenLine size={24} />
            </div>
            <span className="text-sm font-semibold">Manual</span>
          </button>

          <button
            onClick={() => handleSelect("scan")}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95"
          >
            <div className="rounded-full bg-blue-500/10 p-3 text-blue-500">
              <ScanLine size={24} />
            </div>
            <span className="text-sm font-semibold">Scan Struk</span>
          </button>

          <button
            onClick={() => handleSelect("voice")}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95"
          >
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
              <Mic size={24} />
            </div>
            <span className="text-sm font-semibold">Suara</span>
          </button>

          <button
            onClick={() => handleSelect("text")}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform active:scale-95"
          >
            <div className="rounded-full bg-amber-500/10 p-3 text-amber-500">
              <MessageSquare size={24} />
            </div>
            <span className="text-sm font-semibold">Teks Cerdas</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

**Step 2: Run linter/typecheck**

Run: `pnpm check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/transaction/InputMethodDrawer.tsx
git commit -m "feat(transaction): add input method selection drawer"
```

---

### Task 5: Integrate Drawers in Dashboard/Page and Refactor AddTransactionSheet

**Files:**
- Modify: `src/components/transaction/AddTransactionSheet.tsx`
- Modify: `src/app/dashboard/page.tsx` (or wherever the FAB is located)

**Step 1: Clean up AddTransactionSheet**

In `src/components/transaction/AddTransactionSheet.tsx`:
1. Remove the entire `Scan Receipt Button` block (lines 394-452).
2. The file inputs and `handleFileChange` can also be removed if we move the scan logic entirely outside. *However*, for simplicity of this task block, let's keep the scanner logic OUT of `AddTransactionSheet` entirely and move it to a wrapper or the parent.
   Wait, the easiest way to preserve `AddTransactionSheet`'s form state (for manual entry) is to let `AddTransactionSheet` *just* handle the form.
   Let's modify `AddTransactionSheet` to purely be the form.
   Remove `fileInputRef`, `galleryInputRef`, `scanMutation`, `handleFileChange`, and the DropdownMenu from `AddTransactionSheet`.

**Step 2: Update the FAB parent component (e.g. `src/components/shared/AppShell.tsx` or `page.tsx` wherever the FAB state lives)**

Instead of tracking just `isAddTransactionOpen`, we need a manager. Usually, this is in a Provider or AppShell. Let's assume there's a parent component that holds the FAB state. If it's `AppShell.tsx` or a global state, we'll implement it there.

*Wait, since I don't know exactly where the FAB is, I will add an `AddTransactionManager.tsx` wrapper.*

Let's modify `src/components/shared/AppShell.tsx` (which imports `AddTransactionSheet` usually, based on typical T3 apps). Let's check where `AddTransactionSheet` is used.

Actually, let's assume `AddTransactionSheet` is used in `page.tsx`.
Let's modify the plan to introduce `TransactionManager` component.

```tsx
// src/components/transaction/TransactionManager.tsx
"use client";

import React, { useState } from "react";
import { InputMethodDrawer } from "./InputMethodDrawer";
import { SmartInputDrawer } from "./SmartInputDrawer";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { api } from "@/trpc/react";
import { compressImage } from "@/lib/image";

// We need to move the scanner logic here because InputMethodDrawer triggers it
export function TransactionManager({
  fabClicked,
  onFabHandled
}: {
  fabClicked: boolean;
  onFabHandled: () => void
}) {
  const [methodDrawerOpen, setMethodDrawerOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [smartDrawerOpen, setSmartDrawerOpen] = useState(false);
  const [smartMode, setSmartMode] = useState<"text"|"voice">("text");

  const [initialData, setInitialData] = useState<any>(null);

  // ... Scanner logic (refs, mutation) ...
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const scanMutation = api.ai.scanReceipt.useMutation();
  // ... implement handleFileChange exactly like it was in AddTransactionSheet ...
  // When scan finishes successfully: setInitialData(result) -> setAddSheetOpen(true)

  // React to FAB click
  React.useEffect(() => {
    if (fabClicked) {
      setMethodDrawerOpen(true);
      onFabHandled();
    }
  }, [fabClicked]);

  const handleSelectMethod = (method: "manual" | "voice" | "text" | "scan") => {
    if (method === "manual") {
      setInitialData(null);
      setAddSheetOpen(true);
    } else if (method === "voice" || method === "text") {
      setSmartMode(method);
      setSmartDrawerOpen(true);
    } else if (method === "scan") {
      // Open standard OS file picker logic here (or trigger DropdownMenu)
      // Since it's direct click, maybe we just pop standard file picker?
      // Or show standard native picker.
    }
  };

  const handleSmartSuccess = (data: any) => {
    // Map smart data to initialData format expected by AddTransactionSheet
    // Expected: { type, amount, name, date, notes, wallet: {id}, category: {id} }
    const mappedData = {
      type: data.type,
      amount: data.amount || 0,
      name: data.name || "",
      date: data.date || new Date().toISOString(),
      notes: data.notes || "",
      wallet: data.walletId ? { id: data.walletId } : null,
      category: data.categoryId ? { id: data.categoryId } : null,
    };

    setSmartDrawerOpen(false);
    setInitialData(mappedData);
    setAddSheetOpen(true);
  };

  return (
    <>
      <InputMethodDrawer
        open={methodDrawerOpen}
        onOpenChange={setMethodDrawerOpen}
        onSelectMethod={handleSelectMethod}
      />
      <SmartInputDrawer
        open={smartDrawerOpen}
        onOpenChange={setSmartDrawerOpen}
        mode={smartMode}
        onSuccess={handleSmartSuccess}
      />
      <AddTransactionSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        initialData={initialData}
      />
      {/* Hidden file inputs for scanner */}
    </>
  );
}
```

Since refactoring the entire FAB state management across the app might be risky without seeing where it is, **the safer alternative** for Task 5 is to embed the `InputMethodDrawer` directly inside the existing FAB wrapper wherever `isAddTransactionOpen` is triggered.

I will instruct the subagent to use `grep` to find where `AddTransactionSheet` is rendered, and inject the `InputMethodDrawer` and `SmartInputDrawer` there, modifying the state logic accordingly.

**Step 3: Run typecheck**

Run: `pnpm check`
Expected: PASS

**Step 4: Commit**

```bash
git add .
git commit -m "feat(transaction): integrate smart input and input method drawers into main flow"
```

---
