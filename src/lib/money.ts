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

/** Formats integer minor units for display. Currency and locale are the business's, not a default. */
export function formatMoney(
  minorUnits: number,
  options: { currency: string; locale: string },
): string {
  return new Intl.NumberFormat(options.locale, {
    style: "currency",
    currency: options.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}
