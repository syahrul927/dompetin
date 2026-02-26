# Wallet CRUD Feature Design

**Date:** 2026-02-25
**Status:** Approved

## Summary

Connect the existing wallet UI pages to the database via tRPC. Fix bugs in the existing wallet tRPC router, add create/edit/delete UI components using sheet modals, and auto-create a default workspace for new users.

## Decisions

| Decision | Choice |
|----------|--------|
| Auth method | Google OAuth only (implemented) |
| Create/Edit flow | Sheet/drawer modal |
| Delete flow | Confirmation dialog required |
| Currency | IDR only |
| Initial balance | Allow setting on create |
| Wallet icon | Emoji picker from preset list |
| Workspace for new users | Auto-create default "Personal" workspace |
| Approach | Fix existing tRPC router + connect UI |

## Data Flow

- **Wallets list** (`/wallets`): `api.wallet.getWallets.useQuery({ workspaceId })`
- **Wallet detail** (`/wallets/[id]`): `api.wallet.getWallet.useQuery({ id })`
- **Create wallet**: Sheet modal, `api.wallet.createWallet.useMutation()`
- **Edit wallet**: Sheet modal pre-filled, `api.wallet.updateWallet.useMutation()`
- **Delete wallet**: Alert dialog, `api.wallet.deleteWallet.useMutation()`
- **Workspace bootstrap**: `api.workspace.getOrCreateDefault.useQuery()` on wallet list mount

## tRPC Router Fixes (`src/server/api/routers/wallet.ts`)

1. Add missing imports (`workspaceMember`, `inArray`, `isNull`)
2. Fix `getWallets`: Remove invalid `_count`/`with` patterns, use proper Drizzle query
3. Fix `getWallet`: Use `isNull(deletedAt)` instead of `eq(deletedAt, null)`
4. Fix `updateWallet`: Single `.set({...})` call instead of chained `.set()`
5. Fix `createWallet`: Store balance as string directly (schema is `numeric(15,2)`)

## New tRPC Procedure

### `workspace.getOrCreateDefault`

- Protected procedure (requires auth)
- If user has workspaces via `workspaceMember`, return the first one
- If none exist, create workspace named "Personal" with icon "💼", set user as owner, add as workspace member with role "owner", return it

## New UI Components

### `CreateWalletSheet` (`src/components/wallets/CreateWalletSheet.tsx`)

Sheet/drawer containing a form with:
- **Name**: Text input, required, max 255 chars
- **Type**: Select from `cash | bank | ewallet | savings | investment`
- **Icon**: Emoji picker grid with presets grouped by wallet type
- **Initial balance**: Number input formatted as IDR, default 0

Uses `react-hook-form` + `zod` for validation. On submit calls `createWallet` mutation, invalidates wallet list query, closes sheet.

### `EditWalletSheet` (`src/components/wallets/EditWalletSheet.tsx`)

Same form as create, pre-filled with existing wallet data. Editable fields: name, icon, isArchived. Type and balance are not editable (balance changes via transactions only).

### `DeleteWalletDialog` (`src/components/wallets/DeleteWalletDialog.tsx`)

Alert dialog showing:
- Wallet name and current balance
- Warning that this archives the wallet
- Cancel and Confirm buttons

On confirm calls `deleteWallet` mutation (soft archive), invalidates wallet list, closes dialog.

### `WalletEmojiPicker` (`src/components/wallets/WalletEmojiPicker.tsx`)

Grid of preset wallet-related emojis:
- Cash: 💵 💰 🪙 💲 🏧
- Bank: 🏦 💳 🏛️
- E-Wallet: 📱 💸 ⚡
- Savings: 🐷 🏠 🎓 ✈️
- Investment: 📈 📊 💎 🏆

## Page Modifications

### `/wallets/page.tsx`

- Replace `MOCK_WALLETS` with `api.wallet.getWallets.useQuery()`
- Call `api.workspace.getOrCreateDefault.useQuery()` to get workspace ID
- Wire "Tambah Dompet" button to open `CreateWalletSheet`
- Show loading skeleton while fetching
- Show empty state when no wallets

### `/wallets/[id]/page.tsx`

- Replace `MOCK_WALLETS` and `MOCK_TRANSACTIONS` with `api.wallet.getWallet.useQuery({ id })`
- Wire edit action to open `EditWalletSheet`
- Add delete action to `WalletActions` that opens `DeleteWalletDialog`
- Show loading skeleton while fetching

## File Changes Summary

| File | Action |
|------|--------|
| `src/server/api/routers/wallet.ts` | Fix bugs |
| `src/server/api/routers/workspace.ts` | Add `getOrCreateDefault` |
| `src/app/wallets/page.tsx` | Replace mocks with tRPC |
| `src/app/wallets/[id]/page.tsx` | Replace mocks with tRPC |
| `src/components/wallets/CreateWalletSheet.tsx` | New |
| `src/components/wallets/EditWalletSheet.tsx` | New |
| `src/components/wallets/DeleteWalletDialog.tsx` | New |
| `src/components/wallets/WalletEmojiPicker.tsx` | New |
