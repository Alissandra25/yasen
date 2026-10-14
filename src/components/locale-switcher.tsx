"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Language endonyms are proper nouns, not UI text to translate per locale.
const LOCALE_NAMES: Record<(typeof routing.locales)[number], string> = {
  en: "English",
  uk: "Українська",
  ru: "Русский",
};

export function LocaleSwitcher({
  compact = false,
  segmented = false,
}: {
  compact?: boolean;
  segmented?: boolean;
}) {
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

  if (segmented) {
    return (
      <div
        role="group"
        aria-label={t("switchLabel")}
        className="inline-flex items-center gap-1 rounded-lg bg-muted p-1"
      >
        {routing.locales.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => changeLocale(loc)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              locale === loc
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LOCALE_NAMES[loc]}
          </button>
        ))}
      </div>
    );
  }

  if (compact) {
    return (
      <select
        aria-label={t("switchLabel")}
        className="h-8 shrink-0 rounded-lg border border-border bg-background px-1.5 text-xs font-medium text-foreground uppercase"
        value={locale}
        onChange={(event) => changeLocale(event.target.value)}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
    );
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
