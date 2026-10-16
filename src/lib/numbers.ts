/** Formats a plain integer with a thousands separator ("1 635", never "1635"). */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}
