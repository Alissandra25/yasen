import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

// Reads the locale as a root parameter (next-intl's recommended next/root-params integration,
// see https://next-intl.dev/blog/nextjs-root-params) instead of through getRequestConfig's own
// requestLocale argument, so every Server Component can read it via getLocale()/useLocale()
// without the [locale] segment's params being threaded down manually.
export default getRequestConfig(async () => {
  const locale = await rootParams.locale();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
