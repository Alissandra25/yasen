import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyBare,
  parseMoney,
  roundHalfAwayFromZero,
} from "./money";

describe("parseMoney", () => {
  it("parses a plain integer amount", () => {
    expect(parseMoney("105")).toBe(10500);
  });

  it("parses two decimal places exactly, unlike parseFloat", () => {
    expect(parseMoney("105.50")).toBe(10550);
    expect(parseMoney("105,50")).toBe(10550);
  });

  it("ignores surrounding and inner spaces", () => {
    expect(parseMoney(" 1 050.50 ")).toBe(105050);
  });

  it("rejects more than two decimal places", () => {
    expect(() => parseMoney("105.505")).toThrow();
  });

  it("rejects non-numeric input", () => {
    expect(() => parseMoney("abc")).toThrow();
    expect(() => parseMoney("-105")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => parseMoney("")).toThrow();
  });
});

describe("roundHalfAwayFromZero", () => {
  it("rounds a positive half up", () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
  });

  it("rounds a negative half down (away from zero)", () => {
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });

  it("rounds non-half values to the nearest integer", () => {
    expect(roundHalfAwayFromZero(1.4)).toBe(1);
    expect(roundHalfAwayFromZero(-1.4)).toBe(-1);
  });
});

describe("formatMoney", () => {
  it("formats kopecks with the currency unit as trailing text, never a symbol", () => {
    expect(formatMoney(10550, { currency: "UAH", locale: "en-US" })).toBe(
      "105.50 UAH",
    );
    expect(formatMoney(10550, { currency: "UAH", locale: "uk" })).toBe(
      "105,50 грн",
    );
  });

  it("keeps two decimal places for a whole amount", () => {
    expect(formatMoney(10000, { currency: "UAH", locale: "en-US" })).toBe(
      "100.00 UAH",
    );
  });
});

// uk's Intl grouping separator is a narrow no-break space, not a plain U+0020.
const normaliseSpaces = (value: string) => value.replace(/\s/g, " ");

describe("formatMoneyBare", () => {
  it("trims a trailing .00 for a whole amount", () => {
    expect(normaliseSpaces(formatMoneyBare(145000, { locale: "uk" }))).toBe(
      "1 450",
    );
  });

  it("keeps significant decimals", () => {
    expect(formatMoneyBare(4550, { locale: "uk" })).toBe("45,5");
  });

  it("never includes a currency symbol or unit", () => {
    expect(formatMoneyBare(100000, { locale: "en-US" })).toBe("1,000");
  });
});
