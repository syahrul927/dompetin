# Split Bill Feature Design

## Overview

Split Bill allows users to input a bill (manually or via AI receipt scan), divide items among participants, preview each person's share, save to DB, and share a public link so non-users can view the breakdown.

## Route Structure

```
/split-bill/new              → Layout with SplitBillProvider context
/split-bill/new/items        → Step 1: Bill input (items, tax, discount, AI scan)
/split-bill/new/split        → Step 2: Assign items to participants
/split-bill/new/preview      → Step 3: Review & submit
/split-bill/[id]             → Result page (authenticated, "Add to transaction" button)
/s/[code]                    → Public share page (no auth, PWA install banner)
```

### Navigation
- `/split-bill/new` redirects to `/split-bill/new/items`
- Direct access to `/split-bill/new/split` or `/preview` with empty context redirects to `/items`
- Browser back/forward works naturally via URL routing
- All step navigation uses Next.js `Link` component
- Stepper indicator at top shows current step (1/2/3)
- `/s/` added to auth middleware exclusion regex

### InputMethodDrawer Changes
- Layout changes from 2-column grid to vertical list (icon + label per row)
- New "Split Bill" option uses `<Link href="/split-bill/new/items">` and closes the drawer

## State Management (SplitBillProvider)

React Context wrapping the `/split-bill/new` layout. State managed via `useReducer`.

```typescript
interface BillItem {
  id: string;           // nanoid for client-side keying
  name: string;
  qty: number;
  price: number;        // price per unit in whole IDR
  // subtotal = qty * price (computed)
}

interface Participant {
  id: string;           // nanoid
  name: string;         // editable label, first one defaults to "Kamu"
  assignments: {
    itemId: string;
    qty: number;        // how many of this item this person claims
  }[];
}

interface SplitBillState {
  items: BillItem[];
  tax: number;          // flat amount in IDR
  discount: number;     // flat amount in IDR
  participants: Participant[];
  // Computed: finalTotal = sum(item.qty * item.price) + tax - discount
}
```

### Key Rules
- First participant ("Kamu") is auto-created and cannot be deleted
- Tax/discount distributed proportionally: person's share = (their items subtotal / items grand total) * tax or discount
- Assignment qty per item across all participants cannot exceed item's total qty
- Context exposes actions: `addItem`, `removeItem`, `updateItem`, `addParticipant`, `removeParticipant`, `setAssignment`, etc.

## Step 1: Bill Input Page (`/split-bill/new/items`)

- Header with back button (Link to `/dashboard`) and title "Split Bill"
- Stepper indicator: step 1 of 3

### Bill Items Section
- List of item rows: name input, qty input, price input, delete button
- Each row shows computed subtotal (qty x price)
- "Tambah Item" button to add new empty row

### Tax & Discount
- Two input fields: "Pajak" (tax) and "Diskon" (discount)
- Both flat IDR amounts with numeric input

### AI Scan Button
- Prominent button: "Scan Struk (AI)" with sparkle icon
- Dropdown for Camera or Gallery (same pattern as InputMethodDrawer scan)
- Calls new `ai.scanReceiptItems` procedure
- On success, populates items, tax, and discount into context

### Summary Bar
- Sticky bottom: Subtotal, +Tax, -Discount, = Final Total
- "Lanjut" Link to `/split-bill/new/split`, disabled if no valid items

## Step 2: Split Page (`/split-bill/new/split`)

- Header with back (Link to `/split-bill/new/items`) and title "Bagi Tagihan"
- Stepper indicator: step 2 of 3

### Participants Bar (horizontal scroll)
- "+" button to add new participant
- "Kamu" always present, cannot be deleted
- Tapping selects participant (highlighted ring)
- Tap name to inline edit
- Long press on non-"Kamu" to delete

### Items List
- All bill items (read-only name, qty, price)
- When participant is active: qty stepper (-, number, +) per item
- Stepper capped at remaining qty (total minus other participants' claims)
- Highlighted rows where active participant has qty > 0

### Summary Section
- Active participant's share breakdown: items subtotal, tax share, discount share, total
- "Lanjut" Link to `/split-bill/new/preview`, disabled if any items have unassigned qty

## Step 3: Preview Page (`/split-bill/new/preview`)

- Header with back (Link to `/split-bill/new/split`) and title "Ringkasan"
- Stepper indicator: step 3 of 3

### Per-Participant Cards
- Card per participant: name, claimed items list, tax share, discount share, total
- "Kamu" card first with primary border

### Grand Total Bar
- Total bill amount (sum of all shares = final total)

### Submit
- Sticky bottom: "Simpan & Bagikan"
- Calls `splitBill.create` mutation
- Saves to DB, generates short share code (8-char nanoid)
- On success: navigates to `/split-bill/[id]`

## Result & Public Share Pages

### Result Page (`/split-bill/[id]`) — Authenticated
- Same breakdown as preview
- Share banner with `/s/[code]` URL
- Share button: `navigator.share()` or clipboard copy
- "Tambah ke transaksi?" button: creates expense transaction for user's share
- Back link to `/dashboard`

### Public Share Page (`/s/[code]`) — No Auth
- Read-only per-participant breakdown
- Dompetin logo header
- Bottom PWA install banner: "Kelola keuanganmu lebih mudah dengan Dompetin"
- No "Add to transaction" button

## Database Schema

```sql
-- Split Bill (parent)
dompetin_split_bill {
  id              uuid PK default random
  share_code      varchar(16) unique        -- short nanoid for /s/[code]
  title           varchar(255)              -- auto from first item or "Split Bill"
  subtotal        numeric(15,2)             -- sum of items
  tax             numeric(15,2)
  discount        numeric(15,2)
  total           numeric(15,2)             -- subtotal + tax - discount
  workspace_id    uuid FK → workspace (cascade)
  created_by      text FK → user
  transaction_id  uuid FK → transaction nullable  -- linked after "Add to transaction"
  created_at      timestamp with tz
}

-- Split Bill Participant
dompetin_split_bill_participant {
  id              uuid PK default random
  split_bill_id   uuid FK → split_bill (cascade)
  name            varchar(255)              -- "Kamu", "Andi", etc.
  is_owner        boolean                   -- true for logged-in user
  items           jsonb                     -- [{ name, qty, price, subtotal }]
  tax_share       numeric(15,2)
  discount_share  numeric(15,2)
  total           numeric(15,2)
  created_at      timestamp with tz
}
```

JSONB for items because assignments are read-only after save — no need for a separate items join table.

## tRPC Router

New router: `src/server/api/routers/split-bill.ts`

```typescript
splitBill.create            // protectedProcedure — save bill + participants, generate shareCode
splitBill.getById           // protectedProcedure — fetch by id (for /split-bill/[id])
splitBill.getByCode         // publicProcedure — fetch by shareCode (for /s/[code])
splitBill.addToTransaction  // protectedProcedure — create expense from user's share
```

## AI Endpoint

New procedure in `src/server/api/routers/ai.ts`:

```typescript
ai.scanReceiptItems   // protectedProcedure — Groq Vision, returns itemized data
```

Returns:
```json
{
  "success": true,
  "items": [{ "name": "Nasi Goreng", "qty": 2, "price": 25000 }],
  "tax": 5000,
  "discount": 0
}
```

Uses `llama-3.2-11b-vision-preview` (same as current scan). Separate procedure since input/output schema differs from `scanReceipt`.
