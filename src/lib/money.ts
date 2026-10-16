import { z } from "zod";

const MONEY_INPUT_PATTERN = /^\d+([.]\d{1,2})?$/;

// Accepts user-typed text, not a number: spaces out, comma as decimal separator,
// at most two decimals. A bad format is a validation error, never a silent truncation.
export const moneyInputSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, "").replace(",", "."))
  .refine((value) => MONEY_INPUT_PATTERN.test(value), {
    message: "Enter an amount with at most two decimal places, e.g. 105.50.",
  });

/** Parses user-typed money text into integer kopecks. Never use parseFloat directly. */
export function parseMoney(input: string): number {
  const normalised = moneyInputSchema.parse(input);
  return Math.round(Number(normalised) * 100);
}

/** Rounds a fractional amount (e.g. half-kopecks from a profitability split) to the nearest integer, half away from zero. */
export function roundHalfAwayFromZero(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

// Currency unit shown as plain text next to the number, never the ₴ symbol (spec 13.x): the
// mockups spell it out ("9 150,00 грн") instead of using Intl's currency-symbol formatting.
const CURRENCY_LABELS: Record<string, Record<string, string>> = {
  UAH: { en: "UAH", uk: "грн", ru: "грн" },
};

/** The currency unit as plain text ("грн", "UAH"), for a standalone label next to a bare number. */
export function currencyLabel(currency: string, locale: string): string {
  const lang = locale.split("-")[0];
  return CURRENCY_LABELS[currency]?.[lang] ?? currency;
}

/**
 * Formats integer minor units with the currency unit as trailing text (e.g. "9 150,00 грн") —
 * for standalone/summary amounts (cards, totals, buttons). Always two decimals.
 * For a table cell where the unit is already named once in the column header, use
 * `formatMoneyBare` instead so the cell isn't cluttered with a repeated unit.
 */
export function formatMoney(
  minorUnits: number,
  options: { currency: string; locale: string },
): string {
  const number = new Intl.NumberFormat(options.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
  return `${number} ${currencyLabel(options.currency, options.locale)}`;
}

/**
 * Formats integer minor units as a plain grouped number, no currency unit — for table cells
 * whose column header already names the unit ("Сума, грн"). Trims a trailing ".00" so round
 * amounts read as "1 450" rather than "1 450,00", per the mockups.
 */
export function formatMoneyBare(
  minorUnits: number,
  options: { locale: string },
): string {
  return new Intl.NumberFormat(options.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}
