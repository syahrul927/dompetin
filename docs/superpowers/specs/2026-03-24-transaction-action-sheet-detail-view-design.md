# TransactionActionSheet Detail View Design

**Date:** 2026-03-24
**Status:** Approved
**Component:** `TransactionActionSheet`

## Overview

Redesign the TransactionActionSheet from an amount-focused summary to a balanced, structured detail view where all transaction information is equally accessible. Users can review everything at a glance without clicking edit, with special attention to family/shared workspace context.

## Goals

1. **Eliminate blind edits** - Show all relevant transaction details directly in the action sheet
2. **Support family/shared workspaces** - Make creator attribution clear
3. **Improve scannability** - Use icon + label + value pattern for easy reading
4. **Maintain visual balance** - Equal weight for all fields, no single element dominates

## Current State

The existing TransactionActionSheet (`src/components/transaction/TransactionActionSheet.tsx`) shows:
- Title + category + wallet in header
- Large centered amount (hero element)
- Transfer fee (conditional)
- Date below amount
- Notes preview (line-clamp-3, conditional)
- Edit/Delete action buttons

**Problem:** Users must click Edit to see full details like creator information, full notes, or understand the complete transaction context.

## Proposed Design

### Layout Structure

```
┌─────────────────────────────────────┐
│ Merchant Name                      │ ← DrawerTitle (bold, larger)
│ Category · Wallet                 │ ← Context row (muted, smaller)
├─────────────────────────────────────┤
│                                     │
│ 💰 Rp 72.000                      │ ← Amount (md size, balanced)
│ 📅 12 Mar 2026                     │ ← Date
│ 🏷️ Food & Beverage                │ ← Category
│ 👛 GoPay                          │ ← Wallet
│ 👤 Syahrul                        │ ← Created by (NEW)
│                                     │
│ 📝 Notes (if exists):             │ ← Notes section
│    Nasi goreng + es teh...        │
│                                     │
│ 💸 + Biaya Rp 2.500 (if transfer) │ ← Fee row (NEW)
│                                     │
├─────────────────────────────────────┤
│ [✏️ Edit]  [🗑️ Delete]              │ ← Actions (side-by-side)
└─────────────────────────────────────┘
```

### Visual Hierarchy

- **Balanced presentation** - All fields have equal visual weight
- **Amount size** - `size="md"` instead of `"lg"` (not hero, just one of many fields)
- **Consistent row pattern** - Icon + value, left-aligned
- **Muted icons** - All icons use `text-muted-foreground` for consistency
- **Spacing rhythm** - 8dp system (py-2 = 8px vertical, gap-3 = 12px horizontal)

### Component Architecture

**Data Interface:**
```typescript
interface Transaction {
  id: string;
  name: string;
  category: string;
  categoryIcon?: string;
  categoryColor?: string;
  date: string;
  amount: number;
  feeAmount?: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
  notes?: string | null;
  wallet?: { id: string; name: string } | null;
  toWallet?: { id: string; name: string } | null;  // For transfers
  createdBy?: { id: string; name: string } | null;
}
```

**New Imports:**
```typescript
import { Calendar, Tag, Wallet, User, FileText, DollarSign, ArrowRightLeft } from "lucide-react";
```

**Row Component Pattern:**
```tsx
// Reusable detail row component
// py-3 provides 24px total height (12px top/bottom) for adequate touch targets
function DetailRow({ icon: Icon, value }: DetailRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm">{value}</span>
    </div>
  );
}

// Special row for amount (no icon)
function AmountRow({ amount, type }: AmountRowProps) {
  return (
    <div className="py-3">
      <AmountText amount={amount} type={type} size="md" />
    </div>
  );
}
```

### Row Ordering

Fields appear in this logical order:
1. Amount (no icon - color speaks for itself)
2. Fee (only if transfer with fee)
3. Date
4. Category
5. Wallet
6. Created By (only if exists)
7. Notes (only if exists)

### Field Specifications

| Field | Icon | Display Format | Notes |
|-------|------|---------------|-------|
| **Amount** | None | `AmountText` with `size="md"` | No icon needed - color coding is sufficient |
| **Fee** | `DollarSign` | `+ Biaya {formatIDR(feeAmount)}` | Only if feeAmount > 0, immediately after amount |
| **Date** | `Calendar` | `formatDate()` - "12 Mar 2026" | Indonesian locale |
| **Category** | `Tag` | `{category}` | Plain text name |
| **Wallet** | `Wallet` | `{wallet.name}` | Only if wallet exists |
| **Created By** | `User` | `{createdBy.name}` | Only if createdBy exists |
| **Notes** | `FileText` | `{notes}` | Full text, multiline, `mt-0.5` on icon aligns with first line |

### Transfer Transaction Handling

For `transfer_debit` and `transfer_credit` types:
- **Amount display**: Use `AmountText` component which handles color/sign correctly
  - `transfer_debit`: Shows with negative sign and destructive color
  - `transfer_credit`: Shows with positive sign and primary color
- **Wallet display**: For transfers, show both wallets:
  ```tsx
  {type === 'transfer' && transaction.toWallet && (
    <div className="flex items-center gap-3 py-2">
      <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm">
        {wallet?.name} → {transaction.toWallet.name}
      </span>
    </div>
  )}
  ```
- **Fee**: Appears for both debit and credit views, positioned after amount
- **Direction**: The icon-based approach naturally conveys transfer movement

### Spacing & Layout

**Container:**
```tsx
<div className="px-5 pt-4 pb-6">
  {/* Detail rows */}
</div>
```

**Individual Row:**
```tsx
<div className="flex items-center gap-3 py-3">
  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
  <span className="text-sm">{value}</span>
</div>
```

**Spacing Rationale:**
- `py-3` (12px top/bottom) = 24px total height per row
- Provides adequate touch targets while maintaining compact layout
- `gap-3` (12px) horizontal spacing between icon and text
- Consistent with 8dp spacing system (py-3 = 1.5 units)

**Notes Section (special handling):**
```tsx
{notes && (
  <div className="mt-2 pt-2 border-t border-border/50">
    <div className="flex gap-3 py-3">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">
        {notes}
      </p>
    </div>
  </div>
)}
```

**Notes on Notes Section:**
- `mt-2 pt-2 border-t border-border/50` - Visual separator to distinguish notes from structured data
- `mt-0.5` on FileText icon - Aligns icon with first line of potentially multiline text
- `leading-relaxed` - Better line height for readability of longer text content
- `whitespace-pre-wrap` - Preserves line breaks from user input while wrapping naturally

**Action Buttons (unchanged):**
```tsx
<div className="flex gap-2 px-5 pb-5">
  <Button className="flex-1 h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium">
    <Pencil className="mr-2 h-4 w-4" />
    Edit
  </Button>
  <Button variant="outline" className="flex-1 h-11 rounded-full text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive text-sm font-medium">
    <Trash2 className="mr-2 h-4 w-4" />
    Hapus
  </Button>
</div>
```

### Color & Typography

- **Icons:** `text-muted-foreground` (subtle, doesn't compete with content)
- **Labels:** `text-sm` (14px) - consistent with body text scale
- **Values:** `text-sm` - same size as labels, balanced presentation
- **Amount:** Uses existing `AmountText` component with `size="md"`
- **Notes:** `leading-relaxed` for better multiline readability

### Responsive Behavior

- Mobile-first design (currently targets mobile drawers)
- Container width adapts to drawer width
- No horizontal scrolling
- Icon size remains consistent (16px)
- Text wraps naturally on small screens

## Implementation Notes

### Key Changes from Current Implementation

1. **Remove hero amount treatment**
   - Change `<AmountText size="lg" />` to `size="md"`
   - Remove centering wrapper (`flex flex-col items-center`)
   - Integrate into row pattern (no icon, color speaks for itself)

2. **Add structured rows**
   - Each field gets icon + value row (except amount)
   - Consistent `py-3` vertical spacing (24px total for touch targets)
   - `gap-3` horizontal spacing between icon and text

3. **Add "Created By" field**
   - New row with User icon
   - Show creator name
   - Only renders if `createdBy` exists
   - Critical for family/shared workspace context

4. **Update notes display**
   - Remove background card styling (`bg-muted/50`)
   - Remove line-clamp (show full notes)
   - Add visual separator (`border-t`) before notes section
   - Use `whitespace-pre-wrap` for natural wrapping
   - Icon aligned with first line (`mt-0.5`)

5. **Enhance fee display**
   - Move from inline text to dedicated row
   - Add DollarSign icon
   - Position immediately after amount row
   - More consistent with other fields

6. **Handle transfer transactions**
   - Show both wallets with ArrowRightLeft icon
   - Display direction: "From → To"
   - Fee appears for both debit/credit transfer views

### Edge Cases

- **No wallet:** Don't show wallet row
- **No createdBy:** Don't show creator row
- **No notes:** Don't show notes section
- **Zero fee:** Don't show fee row
- **Long notes:** Use `whitespace-pre-wrap` for natural wrapping
- **Very long creator names:** Text wraps naturally

## Design Principles Applied

✅ **Clarity over density** - Each field clearly labeled with icon
✅ **Warm accessibility** - Rounded corners, friendly iconography
✅ **Progressive disclosure** - Only show fields that have data
✅ **Action-oriented hierarchy** - Edit/Delete remain distinct
✅ **Context-aware** - Creator field supports family/shared workspace use

## Acceptance Criteria

1. All transaction details visible without clicking edit
2. Created by field shows for workspace transactions
3. Notes display in full (no truncation)
4. Icons consistent in size and color
5. Spacing follows 8dp rhythm system
6. Layout works on mobile (no horizontal scroll)
7. Action buttons remain accessible at bottom
8. TypeScript interface includes all new fields
9. Non-creator message still displays correctly

## Files to Modify

- `src/components/transaction/TransactionActionSheet.tsx` - Main implementation
- No breaking changes to props interface (already includes optional fields)
