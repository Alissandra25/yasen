import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentBusiness } from "@/server/services/business";

// The business name is data from businesses.name, not UI copy, so it isn't a translation key.
// It's split out and suspended because it's the page's only uncached database read; connection()
// tells the prerenderer this subtree is request-time only, since a DB read isn't one of Next's
// own dynamic APIs it would otherwise detect on its own.
async function BusinessName({ fallback }: { fallback: string }) {
  await connection();
  const business = await getCurrentBusiness();
  return business?.name ?? fallback;
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-24 text-center">
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          <Suspense fallback={t("title")}>
            <BusinessName fallback={t("title")} />
          </Suspense>
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      <p className="max-w-md rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        {t("stageNotice")}
      </p>
    </div>
  );
}
