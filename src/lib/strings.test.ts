import { describe, expect, it } from "vitest";
import { normalizeName } from "./strings";

describe("normalizeName", () => {
  it("ignores case and collapses extra whitespace", () => {
    expect(normalizeName("Bosch Washing Machine")).toBe(
      normalizeName("bosch   washing machine "),
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeName("  Acme  ")).toBe("acme");
  });
});
