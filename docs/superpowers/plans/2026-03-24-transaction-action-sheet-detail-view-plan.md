# TransactionActionSheet Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TransactionActionSheet from amount-focused summary to balanced structured detail view with all transaction information visible at a glance.

**Architecture:** Replace centered hero amount layout with icon-based detail rows. Add created by field for workspace context. Show full notes without truncation. Handle transfer transactions with both wallets displayed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui Drawer components, lucide-react icons

---

## File Structure

**Single file modification:**
- `src/components/transaction/TransactionActionSheet.tsx` - Complete redesign of detail section layout

**No new files needed** - All changes fit within existing component structure.

**Prerequisites:**
- The `toWallet` field is already included in the transaction query (verified in `src/server/api/routers/transaction.ts`)
- The `AmountText` component already supports `size="md"` (verified in `src/components/shared/AmountText.tsx`)
- No database or tRPC router changes needed

---

## Task 1: Update Imports and Interface

**Files:**
- Modify: `src/components/transaction/TransactionActionSheet.tsx:1-41`

Add required icon imports and extend Transaction interface to support transfer transactions.

- [ ] **Step 1: Add new icon imports to existing import**

Replace line 6:
```typescript
import { Pencil, Trash2, Loader2 } from "lucide-react";
```

With:
```typescript
import { Pencil, Trash2, Loader2, Calendar, Tag, Wallet, User, FileText, DollarSign, ArrowRightLeft } from "lucide-react";
```

- [ ] **Step 2: Verify toWallet exists in transaction query**

Run: `grep -n "toWallet" src/server/api/routers/transaction.ts`
Expected: Multiple matches showing `toWallet` is already in the schema and queries

- [ ] **Step 3: Extend Transaction interface to include toWallet**

Add `toWallet?` field at the end of the Transaction interface (before closing brace on line 33):
```typescript
toWallet?: { id: string; name: string } | null;
```

**Context:** The Transaction object is passed as a prop and is populated by the tRPC query. The `toWallet` field is already included in the database query.

- [ ] **Step 4: Verify AmountText component supports size="md"**

Run: `grep -A 10 "interface.*AmountText" src/components/shared/AmountText.tsx`
Expected: See `size?: "sm" | "md" | "lg"` in the interface

- [ ] **Step 5: Verify TypeScript compilation**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "refactor(ui): add icon imports and toWallet field for transfer support"
```

---

## Task 2: Create Reusable Row Components

**Files:**
- Modify: `src/components/transaction/TransactionActionSheet.tsx:43-74`

Add reusable detail row components before the main function to keep code DRY.

- [ ] **Step 1: Add DetailRow component before main function**

Insert after line 42 (before `export function`):
```typescript
interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}

function DetailRow({ icon: Icon, value }: DetailRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm">{value}</span>
    </div>
  );
}

interface AmountRowProps {
  amount: number;
  type: "income" | "expense" | "transfer_debit" | "transfer_credit";
}

function AmountRow({ amount, type }: AmountRowProps) {
  return (
    <div className="py-3">
      <AmountText amount={amount} type={type} size="md" />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "refactor(ui): add reusable DetailRow and AmountRow components"
```

---

## Task 3: Replace Summary Section with Structured Detail Rows

**Files:**
- Modify: `src/components/transaction/TransactionActionSheet.tsx:92-113`

Replace the centered hero amount layout with left-aligned structured detail rows.

- [ ] **Step 1: Replace container className**

Find line 93:
```typescript
<div className="flex flex-col items-center px-5 pt-4 pb-6">
```

Replace with:
```typescript
<div className="px-5 pt-4 pb-6">
```

This removes `flex flex-col items-center` to allow left-aligned rows.

- [ ] **Step 2: Replace amount display**

Find lines 94-95:
```typescript
{/* Large Amount Display */}
<AmountText amount={transaction.amount} type={transaction.type} size="lg" />
```

Replace with:
```typescript
{/* Amount */}
<AmountRow amount={transaction.amount} type={transaction.type} />
```

Uses new `AmountRow` component with `size="md"` (not hero).

- [ ] **Step 3: Replace fee display with structured row**

Find lines 97-102:
```typescript
{transaction.feeAmount && transaction.feeAmount > 0 && (
  <p className="text-xs text-muted-foreground mt-1">
    + Biaya {formatIDR(transaction.feeAmount)}
  </p>
)}
```

Replace with:
```typescript
{transaction.feeAmount && transaction.feeAmount > 0 && (
  <DetailRow
    icon={DollarSign}
    value={`+ Biaya ${formatIDR(transaction.feeAmount)}`}
  />
)}
```

- [ ] **Step 4: Replace date display with structured row**

Find lines 104-105:
```typescript
<p className="text-sm text-muted-foreground mt-2">{formatDate(transaction.date)}</p>
```

Replace with:
```typescript
<DetailRow icon={Calendar} value={formatDate(transaction.date)} />
```

- [ ] **Step 5: Add category detail row**

Add after the date row:
```typescript
<DetailRow icon={Tag} value={transaction.category} />
```

- [ ] **Step 6: Add wallet detail row**

Add after the category row:
```typescript
{transaction.wallet && (
  <DetailRow icon={Wallet} value={transaction.wallet.name} />
)}
```

- [ ] **Step 7: Add created by detail row**

Add after the wallet row:
```typescript
{transaction.createdBy && (
  <DetailRow icon={User} value={transaction.createdBy.name} />
)}
```

- [ ] **Step 8: Verify TypeScript compilation**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "refactor(ui): replace centered layout with structured detail rows"
```

---

## Task 4: Update Notes Section

**Files:**
- Modify: `src/components/transaction/TransactionActionSheet.tsx:107-112`

Remove background card styling, add visual separator, show full notes without truncation.

- [ ] **Step 1: Replace notes section**

Find lines 107-112:
```typescript
{transaction.notes && (
  <div className="mt-4 w-full bg-muted/50 rounded-xl p-3">
    <p className="text-sm line-clamp-3 text-foreground/90">{transaction.notes}</p>
  </div>
)}
```

Replace with:
```typescript
{transaction.notes && (
  <div className="mt-2 pt-2 border-t border-border/50">
    <div className="flex gap-3 py-3">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">
        {transaction.notes}
      </p>
    </div>
  </div>
)}
```

Changes:
- Removed `bg-muted/50 rounded-xl p-3` container styling
- Removed `line-clamp-3` from text
- Added `mt-2 pt-2 border-t border-border/50` visual separator
- Added flex layout with FileText icon
- Added `leading-relaxed whitespace-pre-wrap` for better readability
- Added `mt-0.5` on icon to align with first line of multiline text

- [ ] **Step 2: Verify TypeScript compilation**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "refactor(ui): update notes section with full text and visual separator"
```

---

## Task 5: Add Transfer Transaction Support

**Files:**
- Modify: `src/components/transaction/TransactionActionSheet.tsx:115-143`

Add special handling for transfer transactions to show both wallets with ArrowRightLeft icon.

- [ ] **Step 1: Add transfer wallet row**

Find the wallet row added in Task 3 (Step 6):
```typescript
{transaction.wallet && (
  <DetailRow icon={Wallet} value={transaction.wallet.name} />
)}
```

Replace with:
```typescript
{transaction.wallet && (
  <>
    {(transaction.type === 'transfer_debit' || transaction.type === 'transfer_credit') && transaction.toWallet ? (
      <div className="flex items-center gap-3 py-3">
        <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm">
          {transaction.wallet.name} → {transaction.toWallet.name}
        </span>
      </div>
    ) : (
      <DetailRow icon={Wallet} value={transaction.wallet.name} />
    )}
  </>
)}
```

**Note:** The spec uses `type === 'transfer'` as shorthand, but the actual TypeScript types are `transfer_debit` and `transfer_credit`. The implementation checks for both explicitly to match the type system.

This conditionally shows:
- For transfers: Both wallets with ArrowRightLeft icon ("GoPay → Bank BCA")
- For non-transfers: Single wallet with Wallet icon

- [ ] **Step 2: Verify TypeScript compilation**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "feat(ui): add transfer transaction wallet direction display"
```

---

## Task 6: Visual Verification and Testing

**Files:**
- Test: Manual browser verification

Verify the implementation matches the design specification.

**Pre-requisite:** Development server should be running (`pnpm dev` in background).

- [ ] **Step 1: Start development server**

Run: `pnpm dev`

- [ ] **Step 2: Open TransactionActionSheet**

1. Navigate to http://localhost:3000
2. Open transactions page
3. Tap on any transaction to open action sheet

- [ ] **Step 3: Verify detail rows display correctly**

Check:
- ✅ Amount appears without icon, using `size="md"` (not hero-sized)
- ✅ Fee row appears immediately after amount (if transfer with fee)
- ✅ Date row shows with Calendar icon in "12 Mar 2026" format
- ✅ Category row shows with Tag icon
- ✅ Wallet row shows with Wallet icon
- ✅ Created by row shows with User icon (for workspace transactions)
- ✅ Notes section shows with visual separator and full text
- ✅ All icons use `text-muted-foreground` color
- ✅ All rows use `py-3` spacing (24px height for touch targets)
- ✅ Layout is left-aligned (not centered)

- [ ] **Step 4: Verify transfer transaction display**

For a transfer transaction:
- ✅ Shows both wallets: "GoPay → Bank BCA"
- ✅ Uses ArrowRightLeft icon
- ✅ Fee appears after amount row

- [ ] **Step 5: Verify edge cases**

Test with transactions that have:
- ✅ No wallet (wallet row shouldn't appear)
- ✅ No createdBy (creator row shouldn't appear)
- ✅ No notes (notes section shouldn't appear)
- ✅ Zero fee (fee row shouldn't appear)
- ✅ Long notes (should wrap naturally, no truncation)
- ✅ Non-creator user (shows message, no action buttons)

- [ ] **Step 6: Verify action buttons still work**

- ✅ Edit button closes drawer and opens edit mode
- ✅ Delete button shows confirmation dialog
- ✅ Both buttons maintain correct styling (h-11, rounded-full)

- [ ] **Step 7: Run lint and typecheck**

Run: `pnpm check`
Expected: No ESLint warnings or TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "test: verify TransactionActionSheet detail view implementation"
```

---

## Task 7: Final Polish and Code Review

**Files:**
- Modify: `src/components/transaction/TransactionActionSheet.tsx`

Final review to ensure code quality and consistency.

- [ ] **Step 1: Review code for consistency**

Check:
- ✅ All detail rows use `py-3` spacing
- ✅ All icons are `h-4 w-4` with `text-muted-foreground`
- ✅ All values use `text-sm`
- ✅ No commented-out code left from previous implementation
- ✅ Proper TypeScript types on all props

- [ ] **Step 2: Remove any unused imports**

Check that all imported icons are actually used in the component.

- [ ] **Step 3: Final verification**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 4: Create final commit**

```bash
git add src/components/transaction/TransactionActionSheet.tsx
git commit -m "feat: complete TransactionActionSheet structured detail view redesign

Implement balanced, icon-based detail rows showing all transaction
information at a glance without requiring edit mode.

Changes:
- Replace hero amount with balanced AmountRow component
- Add structured detail rows for all fields (date, category, wallet, creator)
- Add created by field for workspace/family context
- Show full notes without truncation with visual separator
- Add transfer transaction support with both wallets displayed
- Use 8dp spacing system with py-3 for adequate touch targets

Acceptance criteria met:
✅ All details visible without clicking edit
✅ Created by field shows for workspace transactions
✅ Notes display in full with no truncation
✅ Icons consistent in size (h-4 w-4) and color (muted-foreground)
✅ Spacing follows 8dp rhythm (py-3, gap-3)
✅ Layout works on mobile with no horizontal scroll
✅ Action buttons remain accessible
✅ Transfer transactions show both wallets with direction

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
"
```

---

## Summary

This plan transforms the TransactionActionSheet from an amount-focused summary to a comprehensive detail view through 7 bite-sized tasks:

1. **Update imports and interface** - Add icons and toWallet field
2. **Create reusable row components** - DRY DetailRow and AmountRow patterns
3. **Replace summary section** - Left-aligned structured detail rows
4. **Update notes section** - Full text with visual separator
5. **Add transfer support** - Show both wallets with ArrowRightLeft
6. **Visual verification** - Manual testing and validation
7. **Final polish** - Code quality review

Each task commits independently, enabling easy rollback if needed. The implementation follows TDD principles with verification steps and maintains the existing action button functionality.
