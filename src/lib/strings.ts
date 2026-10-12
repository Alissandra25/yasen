/**
 * Case/whitespace-insensitive comparison key, e.g. "Bosch Washing Machine" = "bosch   washing
 * machine ". Shared by supplier on-the-fly creation (spec 3.1) and CSV import's duplicate
 * detection for both products and suppliers (spec 3.2).
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
