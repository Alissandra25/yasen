"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";

// Language endonyms are proper nouns, not UI text to translate per locale.
const LOCALE_NAMES: Record<(typeof routing.locales)[number], string> = {
  en: "English",
  uk: "Українська",
  ru: "Русский",
};

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();

  function changeLocale(nextLocale: string) {
    const segments = pathname.split("/");
    segments[1] = nextLocale;
    // A full navigation, not router.push: switching locale changes the root layout's own
    // dynamic segment, which Next.js would otherwise remount via a client-side RSC transition.
    // next-themes' anti-flash <script> only runs when parsed from real server HTML, not when
    // inserted by a client-side React render, so that remount silently breaks theming.
    window.location.assign(segments.join("/"));
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{t("switchLabel")}</span>
      <select
        className="rounded-lg border border-border bg-background px-2 py-1 text-foreground"
        value={locale}
        onChange={(event) => changeLocale(event.target.value)}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_NAMES[loc]}
          </option>
        ))}
      </select>
    </label>
  );
}
