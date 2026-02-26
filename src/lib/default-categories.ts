/**
 * Hardcoded default categories appended to the category list in the UI.
 * Not stored in DB until a user actually uses one in a transaction (lazy creation).
 *
 * The `key` field is used as a stable identifier with the "default:" prefix
 * (e.g. "default:makanan-minuman") to distinguish from real DB UUIDs.
 */
export const DEFAULT_CATEGORIES = [
  // ── Expense ──
  { key: "makanan-minuman", name: "Makanan & Minuman", icon: "utensils-crossed", type: "expense" as const, color: "#ef4444" },
  { key: "transportasi", name: "Transportasi", icon: "car", type: "expense" as const, color: "#f97316" },
  { key: "belanja", name: "Belanja", icon: "shopping-bag", type: "expense" as const, color: "#ec4899" },
  { key: "tagihan-utilitas", name: "Tagihan & Utilitas", icon: "receipt", type: "expense" as const, color: "#8b5cf6" },
  { key: "hiburan", name: "Hiburan", icon: "gamepad-2", type: "expense" as const, color: "#06b6d4" },
  { key: "kesehatan", name: "Kesehatan", icon: "heart", type: "expense" as const, color: "#10b981" },
  { key: "pendidikan", name: "Pendidikan", icon: "graduation-cap", type: "expense" as const, color: "#3b82f6" },
  { key: "rumah-tangga", name: "Rumah Tangga", icon: "home", type: "expense" as const, color: "#a855f7" },
  { key: "lainnya-expense", name: "Lainnya", icon: "tag", type: "expense" as const, color: "#6b7280" },

  // ── Income ──
  { key: "gaji", name: "Gaji", icon: "banknote", type: "income" as const, color: "#22c55e" },
  { key: "bonus", name: "Bonus", icon: "gift", type: "income" as const, color: "#f59e0b" },
  { key: "investasi", name: "Investasi", icon: "trending-up", type: "income" as const, color: "#3b82f6" },
  { key: "freelance", name: "Freelance", icon: "briefcase", type: "income" as const, color: "#8b5cf6" },
  { key: "lainnya-income", name: "Lainnya", icon: "coins", type: "income" as const, color: "#6b7280" },
] as const;

/** Check if an ID is a default category (not a real DB UUID) */
export function isDefaultCategoryId(id: string): boolean {
  return id.startsWith("default:");
}

/** Get the default category definition by its prefixed ID */
export function getDefaultCategoryByPrefixedId(id: string) {
  const key = id.replace("default:", "");
  return DEFAULT_CATEGORIES.find((c) => c.key === key);
}
