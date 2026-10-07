import { createHash, randomBytes } from "crypto";

/**
 * Webhook secret keys look like `dpt_<64 hex chars>` (32 random bytes).
 * Only the sha256 hash is persisted; the plain key is shown once at creation.
 */
export function generateShortcutKey(): string {
  return `dpt_${randomBytes(32).toString("hex")}`;
}

export function hashShortcutKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
