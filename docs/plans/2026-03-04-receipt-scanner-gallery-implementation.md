# Receipt Scanner Gallery Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to either take a photo or select an existing image from their gallery when scanning a receipt.

**Architecture:** Modify the `AddTransactionSheet.tsx` component to replace the single "Scan Struk" button with a Shadcn `DropdownMenu`. The dropdown will have two options: one for the camera (using `capture="environment"`) and one for the gallery (without `capture`). Both inputs will share the existing file processing logic.

**Tech Stack:** React, Next.js, Shadcn UI (DropdownMenu, Button), Lucide Icons, HTML5 File Input

---

### Task 1: Update AddTransactionSheet UI and State

**Files:**
- Modify: `src/components/transaction/AddTransactionSheet.tsx`

**Step 1: Import required components and icons**
Add the `DropdownMenu` components and `ImagePlus` (or similar) icon to the imports.

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDown, ArrowLeft, Loader2, CalendarIcon, Camera, ImagePlus } from "lucide-react";
```

**Step 2: Add gallery input ref**
Add a new ref for the gallery input next to the existing `fileInputRef`. Rename `fileInputRef` to `cameraInputRef` for clarity, or just keep `fileInputRef` for camera and add `galleryInputRef`. Let's rename to be explicit.

```tsx
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
```

**Step 3: Update `handleFileChange` to reset the correct input**
Modify the `finally` block in `handleFileChange` to reset both inputs so they can be reused.

```tsx
    } finally {
      setIsScanning(false);
      // Reset input so the same file can be selected again
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
```

**Step 4: Replace the single button with a DropdownMenu**
Locate the `Scan Receipt Button` section (around line 394) and replace it with the `DropdownMenu` implementation.

```tsx
            {/* Scan Receipt Button */}
            {!initialData && (
              <div className="flex justify-center mt-4 px-5">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={galleryInputRef}
                  onChange={handleFileChange}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full gap-2 border-primary text-primary hover:bg-primary/10 transition-colors"
                      disabled={isScanning || scanMutation.isPending}
                    >
                      {isScanning || scanMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      Scan / Upload Struk
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-48 rounded-xl">
                    <DropdownMenuItem
                      onClick={() => cameraInputRef.current?.click()}
                      className="gap-2 cursor-pointer py-2.5"
                    >
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span>Ambil Foto</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => galleryInputRef.current?.click()}
                      className="gap-2 cursor-pointer py-2.5"
                    >
                      <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      <span>Pilih dari Galeri</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
```

**Step 5: Run linter/typecheck to verify**

Run: `pnpm check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/transaction/AddTransactionSheet.tsx
git commit -m "feat(transaction): add gallery option for receipt scanner"
```
