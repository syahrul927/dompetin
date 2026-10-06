import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("allows requests under the limit and blocks past it", () => {
    const key = "k1";
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(key, 30, 3600_000)).toBe(true);
    }
    expect(checkRateLimit(key, 30, 3600_000)).toBe(false);
    // other keys unaffected
    expect(checkRateLimit("k2", 30, 3600_000)).toBe(true);
  });

  it("resets after the window passes", () => {
    vi.useFakeTimers();
    const key = "k3";
    for (let i = 0; i < 30; i++) checkRateLimit(key, 30, 1000);
    expect(checkRateLimit(key, 30, 1000)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, 30, 1000)).toBe(true);
    vi.useRealTimers();
  });
});
