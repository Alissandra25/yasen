import { z } from "zod";

/** A date-only value, kept as a 'YYYY-MM-DD' string. Never turn this into a JS Date. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date.");

const MS_PER_DAY = 86_400_000;

function dateOnlyToUtcEpoch(dateOnly: string): number {
  const [year, month, day] = dateOnlySchema
    .parse(dateOnly)
    .split("-")
    .map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcEpochToDateOnly(epoch: number): string {
  const instant = new Date(epoch);
  const year = instant.getUTCFullYear();
  const month = String(instant.getUTCMonth() + 1).padStart(2, "0");
  const day = String(instant.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "Today" in the business time zone, as a date-only string. `now` defaults to the real current instant. */
export function businessToday(
  timeZone: string,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Displays an exact moment (timestamptz) in the business time zone, for the given UI locale. */
export function formatInBusinessTimeZone(
  instant: Date,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
    instant,
  );
}

/** Adds (or subtracts, with a negative count) whole days to a date-only string. */
export function addDaysToDateString(dateOnly: string, days: number): string {
  return utcEpochToDateOnly(dateOnlyToUtcEpoch(dateOnly) + days * MS_PER_DAY);
}

/** -1 / 0 / 1, like a comparator. 'YYYY-MM-DD' strings sort correctly as plain strings. */
export function compareDateStrings(a: string, b: string): -1 | 0 | 1 {
  dateOnlySchema.parse(a);
  dateOnlySchema.parse(b);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Whole days from `a` to `b` (positive if `b` is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (dateOnlyToUtcEpoch(b) - dateOnlyToUtcEpoch(a)) / MS_PER_DAY,
  );
}
