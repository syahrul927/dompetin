# Receipt Scanner Gallery Support Design

## Overview
Enhance the "Scan Struk" feature to allow users to choose an existing receipt photo from their device's gallery, in addition to taking a new photo with the camera.

## Context
Currently, the `AddTransactionSheet.tsx` component has a single "Scan Struk" button that triggers a hidden `<input type="file" accept="image/*" capture="environment">`. The `capture="environment"` attribute forces mobile browsers to open the camera directly, bypassing the gallery file picker. The user wants the flexibility to upload existing receipt images.

## Approach
We will implement a custom dropdown picker using Shadcn UI components. This provides a clear, explicit choice for the user while maintaining a clean UI.

## UI Flow
1. **Trigger Button**: Modify the current "Scan Struk" button.
    *   Change the icon to a combination of `Camera` and `Image` (or a generic `Scan` icon if available/appropriate, but `Camera` + `ImageIcon` or just `ImageIcon` is the current plan). Let's stick with the plan: change text to "Scan / Upload Struk" and use a relevant icon (e.g., `ImagePlus` or keeping `Camera`).
2. **Dropdown Menu**: Clicking the button opens a Shadcn `DropdownMenu`.
3. **Menu Options**:
    *   **Ambil Foto** (Take Photo): Shows a `Camera` icon. Clicking this triggers a hidden input with `capture="environment"`.
    *   **Pilih dari Galeri** (Choose from Gallery): Shows an `Image` icon. Clicking this triggers a hidden input *without* the `capture` attribute.

## Components & Implementation Details
*   **File**: `src/components/transaction/AddTransactionSheet.tsx`
*   **Shadcn Components**: We need to use `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`. (Need to verify if these exist in `@/components/ui/dropdown-menu` and install them via shadcn CLI if not).
*   **Hidden Inputs**:
    *   `cameraInputRef = useRef<HTMLInputElement>(null)` -> `<input type="file" accept="image/*" capture="environment" ... />`
    *   `galleryInputRef = useRef<HTMLInputElement>(null)` -> `<input type="file" accept="image/*" ... />`
*   **Event Handling**: Both hidden inputs will trigger the exact same `handleFileChange` function.
*   **State**: The existing `isScanning` state and `scanMutation.isPending` will wrap the `DropdownMenuTrigger` button to disable it and show a loading spinner while processing.

## Analytics & Error Handling
*   No changes needed. The existing `trackEvent("scan_struk_initiated")` and `trackEvent("scan_struk_success")` inside `handleFileChange` will continue to work correctly regardless of the source of the image.

## Success Criteria
*   User clicks the button and sees a dropdown menu.
*   User can successfully take a new photo using the camera option.
*   User can successfully pick an existing photo from their gallery using the gallery option.
*   Both methods correctly process the receipt via the AI router and populate the transaction form.
