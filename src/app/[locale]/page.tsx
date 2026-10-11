import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentBusiness } from "@/server/services/business";

// Name and description are data from businesses.name/description, not UI copy, so they aren't
// translation keys — the fallbacks are, for the edge case of a fresh install before the one
// business row is seeded. Fetched together so there's one DB read, not two.
// connection() tells the prerenderer this subtree is request-time only, since a DB read isn't one
// of Next's own dynamic APIs it would otherwise detect on its own.
async function BusinessIntro({
  fallbackName,
  fallbackDescription,
}: {
  fallbackName: string;
  fallbackDescription: string;
}) {
  await connection();
  const business = await getCurrentBusiness();

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {business?.name ?? fallbackName}
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        {business?.description ?? fallbackDescription}
      </p>
    </>
  );
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
        <Suspense
          fallback={
            <HomeFallback title={t("title")} subtitle={t("subtitle")} />
          }
        >
          <BusinessIntro
            fallbackName={t("title")}
            fallbackDescription={t("subtitle")}
          />
        </Suspense>
      </div>
      <p className="max-w-md rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        {t("stageNotice")}
      </p>
    </div>
  );
}

function HomeFallback({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">{subtitle}</p>
    </>
  );
}
