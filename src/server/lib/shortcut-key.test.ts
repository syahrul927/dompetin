import { describe, it, expect } from "vitest";
import { generateShortcutKey, hashShortcutKey } from "./shortcut-key";

describe("generateShortcutKey", () => {
  it("returns a dpt_-prefixed 64-char hex key", () => {
    const key = generateShortcutKey();
    expect(key).toMatch(/^dpt_[0-9a-f]{64}$/);
  });

  it("returns a unique key each call", () => {
    expect(generateShortcutKey()).not.toBe(generateShortcutKey());
  });
});

describe("hashShortcutKey", () => {
  it("produces a stable sha256 hex digest", () => {
    expect(hashShortcutKey("dpt_abc")).toHaveLength(64);
    expect(hashShortcutKey("dpt_abc")).toBe(hashShortcutKey("dpt_abc"));
    expect(hashShortcutKey("dpt_abc")).not.toBe(hashShortcutKey("dpt_abd"));
  });

  it("hashes a generated key to something different from the key", () => {
    const key = generateShortcutKey();
    expect(hashShortcutKey(key)).not.toBe(key);
  });
});
