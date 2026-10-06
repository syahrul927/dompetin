import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  buildShortcutPrompt,
  validateShortcutResult,
  parseExpenseMessage,
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

  it("matches wallet by bidirectional substring of walletId", () => {
    const result = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "2026-09-20",
        walletId: "blu",
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

  it("does not match wallets with walletId shorter than 3 chars", () => {
    const result = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "2026-09-20",
        walletId: "a",
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

  it("falls back to first wallet when walletId is null", () => {
    const result = validateShortcutResult(
      {
        name: "X",
        amount: 1000,
        date: "2026-09-20",
        walletId: null,
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

describe("parseExpenseMessage", () => {
  const today = "2026-10-06";
  const realDateNow = Date.now;

  // Freeze the clock so the "today" fallback inside parseExpenseMessage is
  // deterministic if a test ever reaches it.
  beforeAll(() => {
    vi.setSystemTime(new Date(`${today}T00:00:00Z`));
  });
  afterAll(() => {
    vi.useRealTimers();
    Date.now = realDateNow;
  });

  function makeMockClient(content: unknown) {
    const create = vi.fn().mockResolvedValue(content);
    return {
      client: { chat: { completions: { create } } },
      create,
    };
  }

  it("returns null when the model emits non-JSON prose", async () => {
    const { client } = makeMockClient({
      choices: [{ message: { content: "Sorry, I cannot parse that." } }],
    });
    const result = await parseExpenseMessage(client, "ocr text", wallets, categories);
    expect(result).toBeNull();
  });

  it("returns null when choices[0].message.content is missing", async () => {
    const { client } = makeMockClient({ choices: [] });
    const result = await parseExpenseMessage(client, "ocr text", wallets, categories);
    expect(result).toBeNull();
  });

  it("parses valid AI JSON through validation", async () => {
    const aiJson = JSON.stringify({
      name: "RUNPOD.IO",
      amount: 362304,
      date: "2026-09-20",
      walletId: "w-blu",
      categoryId: "default:belanja",
      notes: "ref 0920",
    });
    const { client } = makeMockClient({
      choices: [{ message: { content: aiJson } }],
    });
    const result = await parseExpenseMessage(client, "ocr text", wallets, categories);
    expect(result).toEqual({
      name: "RUNPOD.IO",
      amount: 362304,
      date: "2026-09-20",
      walletId: "w-blu",
      categoryId: "default:belanja",
      notes: "ref 0920",
    });
  });

  it("sends the locked Groq call parameters", async () => {
    const aiJson = JSON.stringify({
      name: "X", amount: 1000, date: null, walletId: "w-blu", categoryId: null, notes: "",
    });
    const { client, create } = makeMockClient({
      choices: [{ message: { content: aiJson } }],
    });
    await parseExpenseMessage(client, "ocr text", wallets, categories);
    expect(create).toHaveBeenCalledTimes(1);
    const firstCall = create.mock.calls[0]! as unknown as [Record<string, unknown>];
    const opts = firstCall[0];
    expect(opts.model).toBe("openai/gpt-oss-120b");
    expect(opts.temperature).toBe(0);
    expect(opts.response_format).toEqual({ type: "json_object" });
  });
});
