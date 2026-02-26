# dompetin — Design System Spec for AI Agent

**Stack:** Next.js App Router · tRPC · BetterAuth · Drizzle · Tailwind CSS · shadcn/ui
**Reference:** `dompetin.html` (visual prototype — use this as the ground truth for how things look)
**Rule:** Always use MCP Shadcn to look up component APIs and implementation details before building any component. Do not guess shadcn props.

---

## 0. Critical Rules Before Writing Any Code

1. **shadcn/ui first.** Every UI element must be built from shadcn components where one exists. Only write custom markup when no shadcn component covers the pattern.
2. **globals.css is already configured.** The shadcn CSS variables in `globals.css` already match the Dompetin color palette. Do not add inline colors or hardcode hex values. Use Tailwind utility classes that map to these variables (`bg-card`, `text-foreground`, `text-muted-foreground`, `border`, etc.).
3. **DM Sans is the font.** It is already set in `globals.css` via `next/font`. Do not import it again.
4. **Mobile-only layout.** The entire app renders inside a `max-w-[390px] mx-auto` container. No responsive breakpoints needed. No sidebar. No desktop layout.
5. **Component folder rules:**
   - `@/components/ui/` — dumb shadcn components only. Already populated. Do not create files here.
   - `@/components/{featureName}/` — smart feature components (connected to tRPC, have state, contain business logic).
   - `@/components/shared/` — dumb reusable components that are custom (not from shadcn), used across multiple features.
6. **No hardcoded data in smart components.** Smart components receive data via tRPC queries or props. Use `Skeleton` from shadcn during loading states.

---

## 1. Design Tokens → Tailwind Mapping

These are already configured in `globals.css`. Use the Tailwind class, never the raw hex.

| Token | Light value | Dark value | Tailwind class |
|---|---|---|---|
| Background | `#FAF8F6` | `#161412` | `bg-background` |
| Card surface | `#FFFFFF` | `#1F1D1B` | `bg-card` |
| Elevated surface | `#F5F2EF` | `#2A2724` | `bg-muted` |
| Primary text | `#1C1A18` | `#F0EDE8` | `text-foreground` |
| Secondary text | `#8C877F` | `#7A736A` | `text-muted-foreground` |
| Tertiary text | `#B8B2A8` | `#4A4540` | `text-muted-foreground/60` |
| Border | `#EDE9E4` | `#2E2B27` | `border` |
| Pink (brand) | `#E8A0A8` | `#D4909A` | `text-primary` / `bg-primary/30` |
| Pink dark (actions) | `#C97880` | `#B8707A` | `bg-primary` / `text-primary` |
| Pink light (tints) | `#F5E0E3` | `#2E1F22` | `bg-primary/10` |
| Negative / expense | `#D97070` | same | `text-destructive` |
| Shadow | `rgba(28,26,24,0.08)` | `rgba(0,0,0,0.3)` | `shadow-sm` (custom in globals) |

> **Do not use** `text-blue-*`, `text-green-*`, `text-purple-*`, or any color outside this palette.

---

## 2. Typography Scale

All font sizes are already in `globals.css`. Use these Tailwind classes exactly.

| Role | Size | Weight | Class |
|---|---|---|---|
| Balance hero (total saldo) | 32px | 700 | `text-[32px] font-bold tracking-tight` |
| Page title | 22px | 700 | `text-[22px] font-bold` |
| Screen header title | 17px | 600 | `text-[17px] font-semibold` |
| Section title | 16px | 600 | `text-base font-semibold` |
| Card number (wallet balance) | 15–16px | 700 | `text-[15px] font-bold` |
| Body / form label | 14–15px | 500 | `text-sm font-medium` |
| Small label | 12px | 400 | `text-xs text-muted-foreground` |
| Meta / timestamp | 11px | 400 | `text-[11px] text-muted-foreground` |
| Amount input (add transaction) | 48px | 700 | `text-5xl font-bold tracking-tighter` |

---

## 3. Spacing & Layout

- **Page padding:** `px-5 pt-6 pb-28` on every scrollable page (pb-28 clears the bottom nav).
- **Card padding:** `p-4` (16px) default. Use `p-5` (20px) for larger cards like balance hero and goal cards.
- **Gap between cards/sections:** `gap-3` (12px) for card lists, `gap-6` (24px) between page sections.
- **Section header margin:** `mb-3.5` (14px) below the header row, `mb-6` (24px) below the section.
- **Border radius:**
  - Cards: `rounded-[20px]` — override shadcn `Card` default.
  - Buttons: `rounded-full` — override shadcn `Button` default.
  - Inputs: `rounded-2xl` (14px) — override shadcn `Input` default.
  - Small icon containers: `rounded-[10px]` or `rounded-[14px]`.
  - Row items (list rows): `rounded-2xl` (16px).

---

## 4. Reusable Layout Components (Shared)

These components are used across multiple pages. Create them in `@/components/shared/`.

---

### 4.1 `AppShell` — `@/components/shared/AppShell.tsx`

**Type:** Dumb layout wrapper
**Purpose:** The root layout wrapper for every authenticated page. Constrains width to mobile, provides the scrollable content area, renders `BottomNav` at the bottom.

```
┌─────────────────────────┐
│   max-w-[390px] mx-auto │
│   relative min-h-screen │
│   bg-background         │
│                         │
│   {children}            │  ← scrollable, pb-28
│                         │
│   <BottomNav />         │  ← fixed bottom
└─────────────────────────┘
```

**Props:**
```ts
interface AppShellProps {
  children: React.ReactNode
}
```

**Implementation notes:**
- Outer div: `className="min-h-screen bg-background"`
- Inner container: `className="max-w-[390px] mx-auto relative min-h-screen"`
- Children wrap: `className="overflow-y-auto scrollbar-hide"`
- `BottomNav` is rendered inside the inner container, `position: fixed` bottom, but constrained to the max-width via `max-w-[390px] mx-auto left-0 right-0`.

---

### 4.2 `BottomNav` — `@/components/shared/BottomNav.tsx`

**Type:** Smart component (reads current pathname via `usePathname`)
**Purpose:** The floating pill navigation bar fixed at the bottom of the screen. Always visible on authenticated pages. Hidden on: `/login`, `/register`, `/onboarding`, and when the Add Transaction Sheet is open.

**Visual spec:**
- Container: `fixed bottom-5 left-1/2 -translate-x-1/2 z-50`
- Inner pill: `bg-card rounded-full px-2 py-3 flex items-center gap-1 shadow-[0_4px_24px_rgba(28,26,24,0.08)] border border-border`
- Width: fits content (5 items × ~56px min-width each)

**5 nav items:**

| Label | Icon (lucide) | Route |
|---|---|---|
| Beranda | `Home` | `/dashboard` |
| Dompet | `Wallet` | `/wallets` |
| Anggaran | `Clock` | `/budget` |
| Tujuan | `Target` | `/goals` |
| Profil | `User` | `/profile` |

**Per nav item:**
- Inactive: icon only, `text-muted-foreground/60`, size 20px, `min-w-14 flex flex-col items-center justify-center gap-0.5 py-2 px-3.5 rounded-full`
- Active: icon + label below, both `text-primary`, icon size 20px, label `text-[10px] font-medium`
- Active state detection: `pathname === route` or `pathname.startsWith(route)` for nested routes
- Press effect: `active:scale-95 transition-transform duration-150`
- No shadcn component — build from scratch with `<Link>` from next/navigation

---

### 4.3 `PageHeader` — `@/components/shared/PageHeader.tsx`

**Type:** Dumb component
**Purpose:** Top header bar used on secondary pages (Wallets, Wallet Detail, Budget, Goals, Profile). Not used on Dashboard (which has its own custom header).

**Two variants:**

**Variant A — Title only** (Wallets page, Budget page, Goals page):
```
┌────────────────────────────────┐
│  [Title 22px bold]   [slot]    │  ← pt-14 pb-4 px-5
└────────────────────────────────┘
```

**Variant B — Back button + centered title + action** (Wallet Detail):
```
┌────────────────────────────────┐
│  [←]   [Title 17px semi]  [⋯] │  ← pt-14 pb-4 px-5
└────────────────────────────────┘
```

**Props:**
```ts
interface PageHeaderProps {
  title: string
  variant?: 'title' | 'back'         // default: 'title'
  onBack?: () => void                 // required if variant='back'
  rightSlot?: React.ReactNode         // optional right element
}
```

**Back button spec:** `w-9 h-9 rounded-full bg-card shadow-sm flex items-center justify-center` — use shadcn `Button` with `variant="ghost"` `size="icon"` and override `className`. Icon: lucide `ChevronLeft` size 18, `text-foreground`.

---

### 4.4 `SectionHeader` — `@/components/shared/SectionHeader.tsx`

**Type:** Dumb component
**Purpose:** The "Title + See All link" row used above every list section.

```
┌──────────────────────────────────┐
│  [Section title]    [Lihat Semua →] │
└──────────────────────────────────┘
```

**Props:**
```ts
interface SectionHeaderProps {
  title: string
  action?: { label: string; href?: string; onClick?: () => void }
}
```

**Spec:**
- Container: `flex items-center justify-between mb-3.5`
- Title: `text-base font-semibold text-foreground`
- Action link: `text-[13px] font-medium text-primary cursor-pointer` — use Next.js `<Link>` if `href` provided, else `<button>`. Use shadcn `Button variant="link"` with `className="p-0 h-auto text-[13px] font-medium text-primary"`.

---

### 4.5 `AmountText` — `@/components/shared/AmountText.tsx`

**Type:** Dumb component
**Purpose:** Formats and renders an IDR amount with correct sign and color. Used in transaction rows and wallet cards.

**Props:**
```ts
interface AmountTextProps {
  amount: number        // raw integer IDR, always positive
  type: 'income' | 'expense' | 'transfer_debit' | 'transfer_credit'
  size?: 'sm' | 'md' | 'lg'  // sm=12px, md=14px, lg=15px
  showSign?: boolean    // default true
}
```

**Logic:**
- `income` / `transfer_credit` → prefix `+`, color `text-primary`
- `expense` / `transfer_debit` → prefix `-`, color `text-destructive`
- Format: `Rp ${amount.toLocaleString('id-ID')}` (produces `Rp 8.500.000`)

---

### 4.6 `TransactionRow` — `@/components/shared/TransactionRow.tsx`

**Type:** Dumb component
**Purpose:** A single transaction list item. Used in Dashboard recent transactions, Wallet Detail transaction list, and any future transaction list. Renders inside a shadcn `Card` as a list with `Separator` between rows.

```
┌──────────────────────────────────────────┐
│ [icon 40×40]  [Name]          [+Rp amt] │
│               [Category · Date]          │
└──────────────────────────────────────────┘
```

**Props:**
```ts
interface TransactionRowProps {
  transaction: {
    id: string
    name: string          // e.g. "Makan Siang"
    category: string      // e.g. "Makanan"
    date: string          // formatted: "1 Feb"
    amount: number
    type: 'income' | 'expense' | 'transfer_debit' | 'transfer_credit'
  }
  onClick?: () => void
}
```

**Visual spec:**
- Row container: `flex items-center gap-3 py-3`
- Icon container: `w-10 h-10 rounded-[14px] bg-muted flex items-center justify-center flex-shrink-0` — contains a lucide icon matching the category (see category→icon map below)
- Name: `text-sm font-medium text-foreground`
- Category + date: `text-xs text-muted-foreground mt-0.5`
- Amount: `text-sm font-semibold` — use `<AmountText>` component
- Separator between rows: use shadcn `<Separator>` with `className="my-0"`

**Category → Lucide Icon map:**
```ts
const CATEGORY_ICONS = {
  makanan: UtensilsCrossed,
  transportasi: Car,
  belanja: ShoppingBag,
  hiburan: Gamepad2,
  tagihan: Receipt,
  kesehatan: Heart,
  pendidikan: BookOpen,
  gaji: Banknote,
  freelance: Laptop,
  bisnis: Briefcase,
  investasi: TrendingUp,
  hadiah: Gift,
  tabungan: PiggyBank,
  transfer_debit: ArrowRightLeft,
  transfer_credit: ArrowRightLeft,
  lainnya: MoreHorizontal,
}
```

---

### 4.7 `FAB` — `@/components/shared/FAB.tsx`

**Type:** Dumb component
**Purpose:** The floating pink action button (+ Add Transaction). Fixed position, bottom-right, above the bottom nav.

**Visual spec:**
- Position: `fixed bottom-[88px] right-5 z-40`
- Button: `w-14 h-14 rounded-full bg-primary shadow-[0_4px_16px_rgba(201,120,128,0.4)] flex items-center justify-center`
- Icon: lucide `Plus`, size 24, `text-white stroke-[2.5]`
- Animation: subtle pulse on box-shadow using Tailwind `animate-pulse` customized — or use `@keyframes fabPulse` in globals
- Press: `active:scale-[0.93] transition-transform duration-150`
- Use shadcn `Button` with `variant="default"` and fully override `className` — do not use the default shadcn button styles

**Props:**
```ts
interface FABProps {
  onClick: () => void
}
```

---

## 5. Feature Components

---

### 5.1 Dashboard Feature — `@/components/dashboard/`

#### `DashboardPage` — `@/app/dashboard/page.tsx`

**Type:** Smart (RSC + tRPC server-side prefetch)
**Prefetch:** `analytics.summary`, `wallet.list`, `transaction.listByWorkspace` (last 10)
**Structure:**

```tsx
<AppShell>
  <div className="px-5 pt-6 pb-28 space-y-6">
    <DashboardHeader />         {/* workspace pill + avatar */}
    <BalanceHeroCard />         {/* total saldo */}
    <SummaryCards />            {/* income + expense 2-col grid */}
    <WalletScroll />            {/* horizontal wallet cards */}
    <TrendChart />              {/* line chart card */}
    <RecentTransactions />      {/* last 10 transactions */}
  </div>
  <FAB onClick={openAddTransaction} />
  <AddTransactionSheet />
</AppShell>
```

---

#### `DashboardHeader` — `@/components/dashboard/DashboardHeader.tsx`

**Type:** Smart (reads active workspace from context/store)
**Purpose:** Top bar with workspace selector pill (navigates to `/workspace`) and user avatar.

**Visual spec:**
```
┌──────────────────────────────────┐
│  [🏠 Pribadi ▾]          [AR]   │
└──────────────────────────────────┘
```

**Workspace pill:**
- Use Next.js `<Link href="/workspace">` wrapping a styled container
- Container: `flex items-center gap-1.5 bg-card border border-border rounded-full py-2 pl-2.5 pr-3.5 shadow-sm cursor-pointer active:scale-[0.97] transition-transform`
- Emoji: `text-sm` (workspace icon)
- Label: `text-[13px] font-semibold text-foreground`
- Chevron: lucide `ChevronDown` size 12, `text-muted-foreground`
- Do NOT use shadcn `DropdownMenu` — it navigates to a page, not a dropdown

**Avatar:**
- `w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary`
- Shows user initials from BetterAuth session
- Use shadcn `Avatar` component with custom fallback

---

#### `BalanceHeroCard` — `@/components/dashboard/BalanceHeroCard.tsx`

**Type:** Smart (receives data from parent or tRPC)
**Purpose:** The dominant visual element on the Dashboard. Shows total workspace balance.

**Visual spec:**
```
┌──────────────────────────────────────────┐  ← rounded-[20px]
│  Total Saldo                             │  ← text-xs text-muted-foreground
│  Rp 24.750.000                           │  ← text-[32px] font-bold tracking-tight
│  3 dompet aktif                          │  ← text-xs text-muted-foreground mt-1
└──────────────────────────────────────────┘
```

- Base: shadcn `Card` with `className="rounded-[20px] p-5 border border-primary/20"` + background `bg-gradient-to-br from-card to-primary/5`
- The gradient goes from `bg-card` (white) to a very faint pink tint `#FDF4F5` — use `from-card to-[#FDF4F5]` in Tailwind or map to a CSS variable
- Loading state: use shadcn `Skeleton` — `<Skeleton className="h-9 w-48 mt-1" />`

**Props:**
```ts
interface BalanceHeroCardProps {
  totalBalance: number
  activeWalletCount: number
  isLoading?: boolean
}
```

---

#### `SummaryCards` — `@/components/dashboard/SummaryCards.tsx`

**Type:** Dumb (receives data as props)
**Purpose:** The 2-column income/expense summary grid below the balance hero.

```
┌───────────────┐ ┌───────────────┐
│ [↑ icon]      │ │ [↓ icon]      │
│ Pemasukan     │ │ Pengeluaran   │
│ Rp 8.500.000  │ │ Rp 3.200.000  │
└───────────────┘ └───────────────┘
```

- Grid: `grid grid-cols-2 gap-3`
- Each card: shadcn `Card` with `className="rounded-[20px] p-3.5 flex flex-col gap-2.5"`
- Icon container:
  - Income: `w-8 h-8 rounded-[10px] bg-primary/10 flex items-center justify-center` + lucide `ArrowUp` size 15, `text-primary stroke-[2.5]`
  - Expense: `w-8 h-8 rounded-[10px] bg-muted flex items-center justify-center` + lucide `ArrowDown` size 15, `text-muted-foreground stroke-[2.5]`
- Label: `text-xs text-muted-foreground`
- Amount:
  - Income: `text-[15px] font-bold text-primary`
  - Expense: `text-[15px] font-bold text-foreground`

**Props:**
```ts
interface SummaryCardsProps {
  monthlyIncome: number
  monthlyExpense: number
  isLoading?: boolean
}
```

---

#### `WalletScroll` — `@/components/dashboard/WalletScroll.tsx`

**Type:** Smart (fetches `wallet.list` via tRPC)
**Purpose:** Horizontal scrollable list of wallet cards on the Dashboard.

**Container:** `flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-5 px-5`
(The negative margin + padding trick extends the scroll area to the screen edge)

**Each wallet card — `WalletCard` (dumb, in `@/components/shared/`):**

```
┌──────────────────┐  ← min-w-[150px], rounded-[20px]
│ Uang Tunai       │  ← text-[11px] font-medium text-muted-foreground
│ Rp 1.200.000     │  ← text-[15px] font-bold text-foreground mt-1
│                  │
│ Tunai            │  ← text-xs font-semibold text-foreground mt-2
└──────────────────┘
```

- Default card: `bg-card border border-transparent shadow-sm rounded-[20px] p-4 flex-shrink-0 cursor-pointer active:scale-[0.97] transition-all`
- **Selected/active card** (first wallet or user-selected): `bg-primary/10 border-primary/40` replacing the default background and border
- On click: navigates to `/wallets/{id}`
- Loading state: show 3 skeleton cards `<Skeleton className="min-w-[150px] h-24 rounded-[20px]" />`

**WalletCard Props:**
```ts
interface WalletCardProps {
  wallet: {
    id: string
    name: string
    type: string
    balance: number
  }
  isSelected?: boolean
  onClick?: () => void
}
```

**SectionHeader above:** `<SectionHeader title="Dompet" action={{ label: "Lihat Semua →", href: "/wallets" }} />`

---

#### `TrendChart` — `@/components/dashboard/TrendChart.tsx`

**Type:** Smart (fetches `analytics.trends` via tRPC, re-fetches on period change)
**Purpose:** Line chart card with period filter pills. Uses shadcn/ui Chart (Recharts wrapper).

**Structure inside a `Card` `rounded-[20px] p-4`:**

```
┌──────────────────────────────────────┐
│  Tren Bulanan    [Harian][Bulanan][Tahunan] │  ← section header row
│                                      │
│  [Recharts LineChart, height=80px]   │
│                                      │
│  Agu  Sep  Okt  Nov  Des  Jan        │  ← x-axis labels, text-[11px] muted
└──────────────────────────────────────┘
```

**Period filter pills:**
- Container: `flex gap-1.5`
- Each pill: shadcn `Button` with `variant="outline"` `size="sm"` — override `className`:
  - Inactive: `rounded-full text-xs font-medium text-muted-foreground border-border h-7 px-3.5`
  - Active: `rounded-full text-xs font-medium text-primary bg-primary/10 border-primary/40 h-7 px-3.5`
- State managed with `useState<'daily' | 'monthly' | 'yearly'>('daily')`

**Recharts config (shadcn Chart wrapper):**
```ts
const chartConfig = {
  value: {
    color: 'hsl(var(--primary))',
  },
}
```
- `<LineChart>` with `height={80}`
- `<Line>` — `strokeWidth={2}` `dot={false}` `activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}`
- `<defs>` with `<linearGradient>` for area fill: from `primary` at 25% opacity to transparent
- `<Area>` fill with the gradient
- No axes labels on the chart itself — labels rendered manually below as `flex justify-between`
- No cartesian grid lines except 2 subtle horizontal dashed lines in `stroke-border`
- Tooltip: shadcn `ChartTooltip` with `ChartTooltipContent`
- Smooth curve: `type="monotone"`

---

#### `RecentTransactions` — `@/components/dashboard/RecentTransactions.tsx`

**Type:** Smart (receives pre-fetched data from parent, no separate query)
**Purpose:** List of last 10 transactions across all wallets in the active workspace.

**Structure:**
```tsx
<SectionHeader title="Transaksi Terbaru" action={{ label: "Lihat Semua →", href: "/transactions" }} />
<Card className="rounded-[20px] divide-y divide-border px-4">
  {transactions.map((tx, i) => (
    <TransactionRow key={tx.id} transaction={tx} />
  ))}
</Card>
```

- Uses shadcn `Card` with `divide-y divide-border` instead of manual `Separator` — produces the thin lines between rows cleanly
- No padding on the Card — `TransactionRow` handles its own `py-3` padding

---

### 5.2 Add Transaction Feature — `@/components/transaction/`

#### `AddTransactionSheet` — `@/components/transaction/AddTransactionSheet.tsx`

**Type:** Smart (manages form state, calls `transaction.create` or `transaction.createTransfer` tRPC mutation)
**Purpose:** The full Add Transaction form, rendered inside a shadcn `Sheet` that slides up from the bottom. Opened by the FAB. Closed by the X button or after successful save.

**Sheet config:**
- Use shadcn `Sheet` with `side="bottom"`
- `SheetContent className="rounded-t-[28px] px-0 pb-0 pt-0 max-h-[92dvh]"`
- `SheetHeader` — custom, not using default shadcn header padding

**Internal structure:**

```
┌─────────────────────────────────────────┐
│  Tambah Transaksi               [X]     │  ← sticky header px-5 pt-5 pb-3
│  ┌─────────────────────────────────┐    │
│  │ Pemasukan │ Pengeluaran │ Transfer│   │  ← TypeToggle component
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│                                         │  ← scrollable content
│         [Amount Input]                  │  ← AmountInput component
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Dompet              BCA      ▾  │    │  ← FormRow (changes for Transfer)
│  │ Kategori         Makanan     ▾  │    │
│  │ Tanggal        22 Feb 2025  ▾  │    │
│  │ Catatan                        │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  [Simpan Transaksi]                     │  ← sticky footer px-5 pb-8 pt-3, border-t
└─────────────────────────────────────────┘
```

---

#### `TypeToggle` — `@/components/transaction/TypeToggle.tsx`

**Type:** Dumb (controlled)
**Purpose:** The 3-option pill segmented control for Income / Expense / Transfer.

**Visual spec:**
- Outer container: `flex bg-muted rounded-full p-1 gap-0.5`
- Each option: `flex-1 py-2 px-3 rounded-full text-[13px] font-medium text-center cursor-pointer transition-all duration-180`
- Inactive: `text-muted-foreground bg-transparent`
- Active: `bg-primary text-white shadow-[0_2px_8px_rgba(201,120,128,0.35)]`
- Do NOT use shadcn `Tabs` — the pill morphing animation looks wrong with tabs. Build with `<button>` elements and state.

**Props:**
```ts
type TransactionType = 'income' | 'expense' | 'transfer'

interface TypeToggleProps {
  value: TransactionType
  onChange: (type: TransactionType) => void
}
```

---

#### `AmountInput` — `@/components/transaction/AmountInput.tsx`

**Type:** Dumb (controlled)
**Purpose:** The large centered amount display. The number grows as the user types. Acts as a custom number input styled to look like large text.

**Visual spec:**
```
     Jumlah (IDR)          ← text-xs text-muted-foreground text-center
     
         0                 ← text-5xl font-bold tracking-tighter text-center
                             text-muted-foreground when empty, text-foreground when filled
```

- Container: `flex flex-col items-center py-6`
- Use a hidden `<input type="number">` for the actual value + a visible `<div>` that displays the formatted number
- The visible div: `text-5xl font-bold tracking-tighter text-center cursor-text min-h-[56px]`
- When value is 0: `text-muted-foreground`
- When value > 0: `text-foreground`
- Do not format with `Rp` prefix here — just the raw number with thousand separators

**Props:**
```ts
interface AmountInputProps {
  value: number
  onChange: (value: number) => void
}
```

---

#### `FormRow` — `@/components/shared/FormRow.tsx`

**Type:** Dumb (display + trigger)
**Purpose:** A tappable row for form fields that open a picker (wallet, category, date). Used exclusively inside `AddTransactionSheet`.

```
┌────────────────────────────────────────┐  ← rounded-2xl bg-card p-4
│  Dompet                   BCA    ▾    │
└────────────────────────────────────────┘
```

- Container: `flex items-center justify-between p-4 bg-card rounded-2xl cursor-pointer active:bg-muted transition-colors`
- Left label: `text-sm font-medium text-foreground`
- Right value: `flex items-center gap-1.5 text-sm text-muted-foreground`
- Chevron: lucide `ChevronDown` size 14, `text-muted-foreground`
- Whole row is a `<button>` or wrapped in shadcn `Button variant="ghost"` with `className` fully overridden

**Props:**
```ts
interface FormRowProps {
  label: string
  value?: string          // display value, e.g. "BCA"
  placeholder?: string    // shown when no value, e.g. "Pilih dompet"
  onClick: () => void
}
```

---

#### `TransferWalletRow` — `@/components/transaction/TransferWalletRow.tsx`

**Type:** Dumb
**Purpose:** The "From → To" wallet selector shown when Transfer type is active. Replaces the single `FormRow` for wallet.

```
┌──────────────────────────────┐
│  Dari Dompet    Tunai    ▾   │  ← FormRow
└──────────────────────────────┘
           ↓                     ← lucide ArrowDown, size 18, centered, text-muted-foreground
┌──────────────────────────────┐
│  Ke Dompet      BCA      ▾   │  ← FormRow
└──────────────────────────────┘
```

- Container: `flex flex-col gap-0` with the arrow between rows
- Arrow: `flex justify-center py-1` + `<ArrowDown size={18} className="text-muted-foreground" />`

---

#### `WalletPicker` & `CategoryPicker` — inside `@/components/transaction/`

**Type:** Dumb (controlled)
**Purpose:** Picker sheets that open when the user taps FormRow items.

Use a **nested shadcn `Sheet`** (bottom sheet) for both pickers:
- `side="bottom"` `className="rounded-t-[24px] max-h-[60dvh]"`
- Title at top
- List of options using shadcn `Command` component for filterable wallet list
- Each option: a button row with name + optional subtitle, checkmark `✓` if selected

---

### 5.3 Wallets Feature — `@/components/wallets/`

#### Wallets Page — `@/app/wallets/page.tsx`

**Type:** Smart RSC
**Prefetch:** `wallet.list`

**Structure:**
```tsx
<AppShell>
  <PageHeader title="Dompet" rightSlot={<span className="text-sm text-muted-foreground">Pribadi</span>} />
  <div className="px-5 pb-28 space-y-3">
    {wallets.map(wallet => <WalletListItem key={wallet.id} wallet={wallet} />)}
    <AddWalletButton />
  </div>
</AppShell>
```

---

#### `WalletListItem` — `@/components/wallets/WalletListItem.tsx`

**Type:** Dumb
**Purpose:** Full-width wallet row in the Wallets list page.

```
┌────────────────────────────────────────────────┐  ← Card rounded-[20px]
│  [icon 44×44]   Tunai              Rp 1.200.000 │
│                 Uang Tunai           3 transaksi │  →
└────────────────────────────────────────────────┘
```

- Base: shadcn `Card` `className="rounded-[20px] p-4 flex items-center gap-4 cursor-pointer active:bg-muted/50 transition-colors"`
- Icon container: `w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0` (first wallet uses `bg-primary/10`, others use `bg-muted`)
- Icon: lucide icon matching wallet type (Cash→`Banknote`, Bank→`Building2`, EWallet→`Smartphone`, Savings→`PiggyBank`, Business→`Briefcase`, Custom→`Wallet`)
- Wallet name: `text-base font-semibold text-foreground`
- Type label: `text-[11px] text-muted-foreground`
- Balance: `text-base font-bold text-foreground text-right`
- Transaction count: `text-[11px] text-muted-foreground text-right`
- Chevron: `<ChevronRight size={16} className="text-muted-foreground/60 ml-auto flex-shrink-0" />`

**Props:**
```ts
interface WalletListItemProps {
  wallet: {
    id: string
    name: string
    type: string
    balance: number
    transactionCount: number
  }
  onClick: () => void
}
```

---

#### Wallet Detail Page — `@/app/wallets/[id]/page.tsx`

**Type:** Smart RSC
**Prefetch:** `wallet.getById`, `transaction.listByWallet`

**Structure:**
```tsx
<AppShell>
  <PageHeader variant="back" title={wallet.name} rightSlot={<MoreOptionsButton />} />
  <div className="px-5 pb-28 space-y-6">
    <WalletBalanceCard />       {/* balance hero, centered */}
    <WalletActions />           {/* Transfer + Edit buttons grid */}
    <WalletMonthlySummary />    {/* income vs expense card */}
    <WalletTransactionList />   {/* transactions filtered by wallet */}
  </div>
</AppShell>
```

---

#### `WalletBalanceCard` — `@/components/wallets/WalletBalanceCard.tsx`

**Type:** Dumb
**Purpose:** Centered balance display card on wallet detail page.

```
┌──────────────────────────────────────────┐
│           Saldo Saat Ini                 │  ← text-xs text-muted-foreground text-center
│           Rp 18.350.000                  │  ← text-[32px] font-bold tracking-tight text-center
│           Rekening Bank                  │  ← text-[11px] text-muted-foreground text-center mt-1
└──────────────────────────────────────────┘
```

- Same gradient style as `BalanceHeroCard`: `bg-gradient-to-br from-card to-[#FDF4F5] border border-primary/20 rounded-[20px] p-6 text-center`

---

#### `WalletActions` — `@/components/wallets/WalletActions.tsx`

**Type:** Dumb
**Purpose:** The two action buttons on Wallet Detail.

- `grid grid-cols-2 gap-2.5`
- Transfer button: shadcn `Button` `variant="default"` `className="rounded-full h-11 text-sm font-semibold"` — opens `AddTransactionSheet` with Transfer type pre-selected and this wallet as source
- Edit button: shadcn `Button` `variant="outline"` `className="rounded-full h-11 text-sm font-semibold border-primary/40 text-primary hover:bg-primary/5"`

---

#### `WalletMonthlySummary` — `@/components/wallets/WalletMonthlySummary.tsx`

**Type:** Dumb
**Purpose:** Side-by-side income vs expense summary within a card.

```
┌────────────────────────────────────────┐
│  Ringkasan Bulan Ini                   │  ← text-sm font-semibold mb-3
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Pemasukan    │  │ Pengeluaran  │   │
│  │ Rp 8.500.000 │  │ Rp 2.800.000 │   │
│  │ [pink bar]   │  │ [gray bar]   │   │
│  └──────────────┘  └──────────────┘   │
└────────────────────────────────────────┘
```

- Card: shadcn `Card` `className="rounded-[20px] p-4"`
- 2-col grid inside: `grid grid-cols-2 gap-3`
- Progress bars: use shadcn `Progress` component
  - Income bar: `className="h-1.5 mt-2"` — override indicator color to `bg-primary`
  - Expense bar: `className="h-1.5 mt-2"` — override indicator color to `bg-muted-foreground`

---

#### `WalletTransactionList` — `@/components/wallets/WalletTransactionList.tsx`

**Type:** Smart (client component, supports pagination)
**Purpose:** Paginated transaction list filtered to a specific wallet. 20 per page.

**Structure:**
```tsx
<SectionHeader title="Transaksi" rightSlot={<span className="text-[11px] text-muted-foreground">Februari 2025</span>} />
<Card className="rounded-[20px] divide-y divide-border px-4">
  {transactions.map(tx => <TransactionRow key={tx.id} transaction={tx} />)}
</Card>
{hasMore && <LoadMoreButton />}
```

---

## 6. shadcn Components Usage Reference

Quick map of which shadcn components to use for each pattern. Always check MCP Shadcn for exact props.

| Pattern | shadcn Component | Key overrides |
|---|---|---|
| Content cards | `Card`, `CardContent` | `className="rounded-[20px]"` on Card |
| Primary button | `Button variant="default"` | `className="rounded-full h-12 font-semibold"` |
| Outline button | `Button variant="outline"` | `className="rounded-full h-12 font-semibold border-primary/40 text-primary"` |
| Ghost / link button | `Button variant="ghost"` or `variant="link"` | for nav actions, back button |
| Text inputs | `Input` | `className="rounded-2xl h-14 border-border focus-visible:ring-primary"` |
| Form labels | `Label` | `className="text-xs font-medium text-muted-foreground"` |
| Bottom sheet | `Sheet side="bottom"` | `className="rounded-t-[28px]"` on SheetContent |
| Progress bars | `Progress` | always `className="h-1.5 rounded-full"`, override indicator via CSS |
| Loading skeletons | `Skeleton` | match exact dimensions of the element being loaded |
| Dividers in lists | `Separator` | `className="my-0"` — removes extra margin |
| Toast notifications | `useToast` + `Toaster` | already in layout, just call `toast()` |
| Avatars | `Avatar`, `AvatarFallback` | `className="w-9 h-9 bg-primary/10"` on Avatar, `className="text-xs font-bold text-primary"` on Fallback |
| Badges | `Badge` | `variant="secondary"` for gray, custom `className` for pink |

---

## 7. Animation & Interaction Rules

- **Page enter:** `animate-in fade-in slide-in-from-bottom-2 duration-200` on the main content wrapper of each page.
- **List stagger:** Apply `style={{ animationDelay: `${index * 40}ms` }}` to each card in a list alongside `animate-in fade-in slide-in-from-bottom-1`.
- **Button press:** All interactive elements use `active:scale-[0.97] transition-transform duration-150`. Never use hover animations on mobile.
- **Sheet open/close:** shadcn Sheet handles this natively — do not add custom animations.
- **Progress bar fill:** On mount, animate from 0 to target value using a CSS transition. Set `style={{ width: 0 }}` initially, then after mount set to the real percentage. Use `transition-all duration-1000 ease-out` on the progress indicator.
- **Workspace switch:** On switching workspace, wrap the main content in a `key={activeWorkspaceId}` so React remounts + re-animates the page naturally.
- **No bounce:** Do not use `spring` or `bounce` easing anywhere. Use `ease-out` exclusively.

---

## 8. File Structure Reference

```
src/
├── app/
│   ├── layout.tsx                    ← root layout, Toaster, font
│   ├── dashboard/
│   │   └── page.tsx                  ← smart RSC
│   ├── wallets/
│   │   ├── page.tsx                  ← smart RSC
│   │   └── [id]/
│   │       └── page.tsx              ← smart RSC
│   ├── budget/
│   │   └── page.tsx
│   ├── goals/
│   │   └── page.tsx
│   ├── workspace/
│   │   └── page.tsx
│   └── profile/
│       └── page.tsx
│
├── components/
│   ├── ui/                           ← shadcn only, do not modify
│   │
│   ├── shared/                       ← dumb, used across features
│   │   ├── AppShell.tsx
│   │   ├── BottomNav.tsx             ← smart (uses usePathname)
│   │   ├── PageHeader.tsx
│   │   ├── SectionHeader.tsx
│   │   ├── FAB.tsx
│   │   ├── TransactionRow.tsx
│   │   ├── AmountText.tsx
│   │   ├── WalletCard.tsx
│   │   └── FormRow.tsx
│   │
│   ├── dashboard/                    ← smart feature components
│   │   ├── DashboardHeader.tsx
│   │   ├── BalanceHeroCard.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── WalletScroll.tsx
│   │   ├── TrendChart.tsx
│   │   └── RecentTransactions.tsx
│   │
│   ├── transaction/                  ← smart feature components
│   │   ├── AddTransactionSheet.tsx
│   │   ├── TypeToggle.tsx
│   │   ├── AmountInput.tsx
│   │   ├── TransferWalletRow.tsx
│   │   ├── WalletPicker.tsx
│   │   └── CategoryPicker.tsx
│   │
│   └── wallets/                      ← smart feature components
│       ├── WalletListItem.tsx
│       ├── WalletBalanceCard.tsx
│       ├── WalletActions.tsx
│       ├── WalletMonthlySummary.tsx
│       └── WalletTransactionList.tsx
│
└── lib/
    └── formatIDR.ts                  ← shared currency formatter
```

---

## 9. `formatIDR` Utility

Every component that displays an IDR amount must use this utility. Never format inline.

```ts
// src/lib/formatIDR.ts
export function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

// Output: formatIDR(18350000) → "Rp 18.350.000"
```

---

*dompetin — Design System Spec — v1.0 — February 2025*
*Reference prototype: dompetin.html*
