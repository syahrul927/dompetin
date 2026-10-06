import { describe, it, expect } from "vitest";
import {
  buildShortcutPrompt,
  validateShortcutResult,
} from "./shortcut";

const wallets = [
  { id: "w-blu", name: "blu BCA", type: "bank" },
  { id: "w-mandiri", name: "Livin Mandiri", type: "bank" },
  { id: "w-cash", name: "Cash", type: "cash" },
];

const categories = [
  { id: "default:belanja", name: "Belanja" },
  { id: "default:lainnya-expense", name: "Lainnya" },
  { id: "c-hobby", name: "Hobby" },
];

describe("buildShortcutPrompt", () => {
  it("includes wallet names/ids and category names/ids in the prompt", () => {
    const prompt = buildShortcutPrompt(wallets, categories);
    expect(prompt).toContain("blu BCA");
    expect(prompt).toContain("w-blu");
    expect(prompt).toContain("default:belanja");
    expect(prompt).toContain("Hobby");
  });

  it("contains the Indonesian number-format and IDR-total rules", () => {
    const prompt = buildShortcutPrompt(wallets, categories);
    expect(prompt).toContain("THOUSAND");
    expect(prompt).toContain("IDR");
    expect(prompt).toContain("walletId");
    expect(prompt).toContain("categoryId");
  });
});

describe("validateShortcutResult", () => {
  const today = "2026-10-06";

  it("accepts known wallet/category ids", () => {
    const result = validateShortcutResult(
      {
        name: "RUNPOD.IO",
        amount: 362304,
        date: "2026-09-20",
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "ref 0920",
      },
      wallets,
      categories,
      today,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        name: "RUNPOD.IO",
        amount: 362304,
        date: "2026-09-20",
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "ref 0920",
      },
    });
  });

  it("falls back to first wallet when walletId is unknown", () => {
    const result = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "2026-09-20",
        walletId: "w-unknown",
        categoryId: "default:belanja",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.walletId).toBe("w-blu");
  });

  it("falls back to lainnya category when categoryId is unknown", () => {
    const result = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "2026-09-20",
        walletId: "w-blu",
        categoryId: "c-nope",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.categoryId).toBe("default:lainnya-expense");
  });

  it("uses today when date is missing or unparseable", () => {
    const bad = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "garbage",
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(bad.value.date).toBe(today);

    const missing = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: null,
        walletId: "w-blu",
        categoryId: "default:belanja",
        notes: "",
      },
      wallets,
      categories,
      today,
    );
    if (missing.ok) expect(missing.value.date).toBe(today);
  });

  it("returns ok:false when name/amount are missing or amount is not positive", () => {
    expect(
      validateShortcutResult(
        { name: null, amount: 100, date: null, walletId: "w-blu", categoryId: null, notes: "" },
        wallets,
        categories,
        today,
      ).ok,
    ).toBe(false);
    expect(
      validateShortcutResult(
        { name: "X", amount: 0, date: null, walletId: "w-blu", categoryId: null, notes: "" },
        wallets,
        categories,
        today,
      ).ok,
    ).toBe(false);
  });
});
