import { describe, expect, it } from "vitest";
import { needsStocktakeAdjustment } from "./stocktakes";

describe("needsStocktakeAdjustment", () => {
  it("is false for an uncounted line", () => {
    expect(needsStocktakeAdjustment(10, null)).toBe(false);
  });

  it("is false when the count matches the system quantity", () => {
    expect(needsStocktakeAdjustment(10, 10)).toBe(false);
  });

  it("is true for a shortage", () => {
    expect(needsStocktakeAdjustment(10, 8)).toBe(true);
  });

  it("is true for a surplus", () => {
    expect(needsStocktakeAdjustment(10, 13)).toBe(true);
  });

  it("is true when a negative system quantity is counted back to zero", () => {
    expect(needsStocktakeAdjustment(-1, 0)).toBe(true);
  });

  it("is false when a zero count matches a zero system quantity", () => {
    expect(needsStocktakeAdjustment(0, 0)).toBe(false);
  });
});
