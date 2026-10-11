import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/server/actions/auth";

export async function AppHeader() {
  const locale = await getLocale();
  const t = await getTranslations("nav");

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
      <Link
        href={`/${locale}`}
        className="text-sm font-semibold tracking-tight text-foreground"
      >
        {t("home")}
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/settings`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("settings")}
        </Link>
        <LocaleSwitcher />
        <ThemeToggle />
        <form action={logoutAction.bind(null, locale)}>
          <Button type="submit" variant="outline" size="sm">
            {t("logout")}
          </Button>
        </form>
      </div>
    </header>
  );
}
