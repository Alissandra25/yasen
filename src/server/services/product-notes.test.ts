import { describe, expect, it } from "vitest";
import { isNoteActiveForMonth } from "./product-notes";

describe("isNoteActiveForMonth", () => {
  it("is active in its own starting month", () => {
    expect(isNoteActiveForMonth("2026-10", "2026-10", "2026-10")).toBe(true);
  });

  it("is not active before validFrom", () => {
    expect(isNoteActiveForMonth("2026-10", "2026-10", "2026-09")).toBe(false);
  });

  it("is not active after validTo when it does not carry over", () => {
    expect(isNoteActiveForMonth("2026-10", "2026-10", "2026-11")).toBe(false);
  });

  it("stays active indefinitely when validTo is null (carries over)", () => {
    expect(isNoteActiveForMonth("2026-10", null, "2027-03")).toBe(true);
  });

  it("is active across a multi-month explicit range", () => {
    expect(isNoteActiveForMonth("2026-10", "2026-12", "2026-11")).toBe(true);
    expect(isNoteActiveForMonth("2026-10", "2026-12", "2026-12")).toBe(true);
    expect(isNoteActiveForMonth("2026-10", "2026-12", "2027-01")).toBe(false);
  });
});
