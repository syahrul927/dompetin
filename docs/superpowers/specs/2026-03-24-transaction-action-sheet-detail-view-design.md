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
  createdBy?: { id: string; name: string } | null;
}
```

**New Imports:**
```typescript
import { Calendar, Tag, Wallet, User, FileText, DollarSign } from "lucide-react";
```

**Row Component Pattern:**
```tsx
// Reusable detail row component
function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm">{value}</span>
    </div>
  );
}
```

### Field Specifications

| Field | Icon | Display Format | Notes |
|-------|------|---------------|-------|
| **Amount** | `DollarSign` | `AmountText` with `size="md"` | Balanced size, not hero |
| **Date** | `Calendar` | `formatDate()` - "12 Mar 2026" | Indonesian locale |
| **Category** | `Tag` | `{category}` | Plain text name |
| **Wallet** | `Wallet` | `{wallet.name}` | Only if wallet exists |
| **Created By** | `User` | `{createdBy.name}` | Only if createdBy exists |
| **Notes** | `FileText` | `{notes}` | Full text, no line-clamp, multiline if needed |
| **Fee** | `DollarSign` | `+ Biaya {formatIDR(feeAmount)}` | Only if feeAmount > 0 |

### Spacing & Layout

**Container:**
```tsx
<div className="px-5 pt-4 pb-6">
  {/* Detail rows */}
</div>
```

**Individual Row:**
```tsx
<div className="flex items-center gap-3 py-2">
  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
  <span className="text-sm">{value}</span>
</div>
```

**Notes Section (special handling):**
```tsx
{notes && (
  <div className="flex gap-3 py-2">
    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
    <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">
      {notes}
    </p>
  </div>
)}
```

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
   - Remove centering wrapper
   - Integrate into row pattern

2. **Add structured rows**
   - Each field gets icon + value row
   - Consistent `py-2` vertical spacing
   - `gap-3` horizontal spacing between icon and text

3. **Add "Created By" field**
   - New row with User icon
   - Show creator name
   - Only renders if `createdBy` exists

4. **Update notes display**
   - Remove background card styling
   - Remove line-clamp
   - Show full notes with `whitespace-pre-wrap`
   - Keep icon alignment with other rows

5. **Enhance fee display**
   - Currently shown below amount
   - Move to dedicated row with DollarSign icon
   - More consistent with other fields

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
