// All three locale files share one key structure (enforced by scripts/i18n-check.mjs), so en's
// shape is a safe stand-in for typing createTranslator's ICU argument checking at every locale.
type Messages = typeof import("../../messages/en.json");

/**
 * Loads one locale's messages directly, for contexts next-intl's own request-scoped helpers
 * can't reach — Route Handlers in this Next.js version don't support the `next/root-params`
 * read that `src/i18n/request.ts` relies on (see that file's comment), so a PDF route builds
 * its own translator with `createTranslator` from `next-intl` instead of `getTranslations`.
 */
export async function loadMessages(locale: string): Promise<Messages> {
  return (await import(`../../messages/${locale}.json`)).default;
}
