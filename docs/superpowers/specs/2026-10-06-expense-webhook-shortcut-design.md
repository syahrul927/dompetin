# Expense Webhook Shortcut API — Design

Date: 2026-10-06

## Goal

Public API endpoint that lets users (primarily via an iOS Shortcut) create expense
transactions by sending raw OCR text captured from bank/e-wallet screenshots. The API
authenticates with a per-user-per-workspace secret key, uses Groq to parse the message
into a structured expense, creates the transaction immediately (no confirmation step),
and returns a deep-link URL so the PWA opens the transaction summary drawer for review.

## Non-Goals

- No income/transfer support through this endpoint (all transactions are expenses).
- No confirmation/review round-trip — creation is immediate.
- No default wallet fallback — AI always picks the closest wallet; user fixes mistakes
  in the app.
- No distributed rate limiting (in-memory per instance is acceptable for now).

## Data Model

New table `dompetin_webhook`:

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | default random |
| workspaceId | uuid fk → dompetin_workspace | cascade delete |
| userId | text fk → user | cascade delete |
| name | varchar(255) | e.g. "iPhone Shortcut" |
| keyHash | text, unique index | sha256 hex of full key |
| lastUsedAt | timestamp | updated on each successful auth |
| createdAt / updatedAt | timestamp | defaults |

Key format: `dpt_` + 32 random bytes hex (e.g. `dpt_a1b2...` 64 hex chars total after
prefix). The plain key is shown exactly once at creation/regeneration; only the sha256
hash is stored. Verification compares sha256 of the presented key against `keyHash`.

One integration per user per workspace (enforced in the tRPC create procedure — a
user cannot create a second integration for the same workspace; they regenerate
instead).

## Endpoint

`POST /api/shortcut/expense` — Next.js route handler
(`src/app/api/shortcut/expense/route.ts`), no session auth.

Request:

- Header: `secret-key: dpt_...`
- Body: `{ "message": "<raw OCR text>" }`, message capped at 4000 characters.

Flow:

1. Missing/unknown key → `401`. Hash lookup via unique index; comparison is safe by
   construction (exact hash match). Update `lastUsedAt`.
2. Rate limit: in-memory Map keyed by keyHash, 30 requests/hour → `429` when exceeded.
   (Known limitation: per server instance on serverless. Upgrade path: DB counter.)
3. Load workspace wallets (not archived) and expense categories for the key's
   workspace.
4. Call Groq parse service.
5. Validate returned `walletId`/`categoryId` against the actual lists; unknown IDs
   fall back to first wallet / "lainnya" expense category. Transaction is always
   created on a successful parse.
6. Insert transaction: type `expense`, `walletId`, `categoryId`, `workspaceId`,
   `createdBy` = key's user, date from parse (or today).
7. Respond `201`:

```json
{
  "success": true,
  "transaction": {
    "id": "...", "name": "...", "amount": 362304,
    "date": "2026-09-20",
    "walletId": "...", "walletName": "blu BCA",
    "categoryId": "...", "categoryName": "Shopping"
  },
  "url": "https://<request-origin>/transactions?tx={txId}"
}
```

The URL host comes from the incoming request's `origin` header — no new env var;
works on any deployment.

Errors:

| Status | When | Body |
|---|---|---|
| 400 | missing/oversized/invalid body | `{ success: false, error }` |
| 401 | missing/unknown secret key | `{ success: false, error }` |
| 422 | Groq failed, text unparseable, or workspace has no wallets configured | `{ success: false, error }` |
| 429 | rate limit exceeded | `{ success: false, error }` |

## AI Parsing Service

`src/server/services/shortcut.ts`. Groq chat completion, model
`openai/gpt-oss-120b`, temperature 0, JSON response format. Validated live
against the real OCR samples — the previously used
`meta-llama/llama-4-scout-17b-16e-instruct` has been retired by Groq.

Prompt input: raw OCR text + wallet list (id, name, type) + expense category list
(id, name).

Prompt rules:

- The text is OCR output from an Indonesian bank/e-wallet app screenshot — expect
  noise (status bar fragments like "18.31 , 4G", ad banners, UI buttons like
  "Beli sekarang"). Extract only the transaction.
- Indonesian number format: dots are thousands separators. OCR artifacts like
  `Rp 362.304:00` mean `362.304,00` → 362304. Return amount as whole-number IDR.
- If a USD nominal is shown alongside an IDR total (e.g. "Nominal dalam USD $20,00"
  + "Total Bayar Rp 362.304"), use the IDR total.
- Date: parse `DD MMM YYYY` with Indonesian month names (Agu, Sep, ...) and WIB
  timestamps; fall back to today when absent or unparseable.
- MUST decide both, never null:
  - `walletId`: closest match between the issuing bank/e-wallet in the text (e.g.
    "blu BCA Digital", "Mandiri livin") and the provided wallet names.
  - `categoryId`: best-fit expense category; fallback "lainnya" (expense).
- `name`: merchant/recipient/description (e.g. "RUNPOD.IO", "MOCHAMAD SOLEH").
- `notes`: reference numbers, recipient bank details, transaction type.

Output schema (validated with zod in the service):
`{ name, amount (int), date (YYYY-MM-DD), walletId, categoryId, notes }`.

Groq/network failure → service returns failure; route responds `422`. No partial
transaction is created.

## Deep Link UX

Existing behavior: `/transactions` opens a summary drawer when a transaction is
tapped; the summary drawer has an Edit button that opens the edit drawer. Both are
local state (`editTx`), not URL-driven.

Change: `/transactions` reads a `tx` search param. On mount, if `?tx=<id>` is
present, fetch that transaction and open the **summary drawer** (not edit mode),
preserving the existing manual flow: summary first, Edit button second.

Webhook response URL: `https://<origin>/transactions?tx={txId}`.

## tRPC Router — `webhook.ts`

Protected procedures scoped by workspace membership (role check consistent with
existing workspace procedures):

- `webhook.create({ workspaceId, name })` → creates row, returns plain key once.
  Errors if an integration already exists for (user, workspace).
- `webhook.list({ workspaceId })` → rows without keyHash (name, createdAt,
  lastUsedAt).
- `webhook.regenerate({ id })` → replaces keyHash, returns new plain key once.
- `webhook.revoke({ id })` → deletes row.

## UI — Workspace Settings

New "Integrasi / Webhook" section in workspace settings:

- List of integrations: name, created date, last used.
- Create → tRPC `webhook.create` → dialog shows the full webhook URL + secret key
  **once**, with copy buttons and a warning that the key cannot be shown again.
- Regenerate (confirm dialog → shows new key once), Revoke (confirm dialog).
- A sample cURL snippet for quick iOS Shortcut setup.

## Testing

- Unit: key hashing/verification; zod output validation and fallback logic in the
  service; rate limiter; prompt builder.
- Route-level integration tests (Groq mocked: 201/401/400/429/422) were scoped out;
  the route's status codes and the atomic insert+decrement are verified manually
  instead (see Manual below).
- Manual: user's real OCR samples — blu BCA (`RUNPOD.IO`, USD nominal → Rp 362304,
  wallet = blu, category Shopping) and Mandiri livin (transfer to MOCHAMAD SOLEH,
  Rp 300000, wallet = Mandiri).
- Deep link: `/transactions?tx=...` opens summary drawer; Edit opens edit drawer.
