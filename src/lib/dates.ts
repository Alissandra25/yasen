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

/** A calendar month as a 'YYYY-MM' string. "Since start of month" (spec 3.7/4.4) is always in this unit. */
export const monthOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Expected a YYYY-MM month.");

/** The first day of a 'YYYY-MM' month, as a date-only string. */
export function monthStartDate(month: string): string {
  monthOnlySchema.parse(month);
  return `${month}-01`;
}

/** Every date-only string in a 'YYYY-MM' month, in order. */
export function daysInMonth(month: string): string[] {
  const [year, m] = monthOnlySchema.parse(month).split("-").map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const start = monthStartDate(month);
  return Array.from({ length: count }, (_, i) => addDaysToDateString(start, i));
}

/** Adds (or subtracts) whole months to a 'YYYY-MM' month string. */
export function shiftMonth(month: string, deltaMonths: number): string {
  const [year, m] = monthOnlySchema.parse(month).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, m - 1 + deltaMonths, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The calendar month containing "today" in the business time zone. */
export function businessCurrentMonth(
  timeZone: string,
  now: Date = new Date(),
): string {
  return businessToday(timeZone, now).slice(0, 7);
}
