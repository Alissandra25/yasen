import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/server/actions/auth";

export async function AppHeader() {
  const locale = await getLocale();
  const t = await getTranslations("nav");

  const catalogLinks = [
    { href: `/${locale}/locations`, label: t("locationsLink") },
    { href: `/${locale}/categories`, label: t("categoriesLink") },
    { href: `/${locale}/suppliers`, label: t("suppliersLink") },
    { href: `/${locale}/products`, label: t("productsLink") },
  ];

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
      <Link
        href={`/${locale}`}
        className="text-sm font-semibold tracking-tight text-foreground"
      >
        {t("home")}
      </Link>
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            {t("catalog")}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {catalogLinks.map((link) => (
              <DropdownMenuItem
                key={link.href}
                render={<Link href={link.href} />}
              >
                {link.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link
          href={`/${locale}/receipts`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("receiptsLink")}
        </Link>
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
