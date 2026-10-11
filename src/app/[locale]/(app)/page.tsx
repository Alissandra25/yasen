import { getTranslations } from "next-intl/server";
import { getCurrentBusiness } from "@/server/services/business";

export default async function Home() {
  const t = await getTranslations("home");
  const business = await getCurrentBusiness();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-3">
        {/* Name and description are data from businesses.name/description, not UI copy, so
            they aren't translation keys. The fallbacks are, for a fresh installation before the
            one business row is seeded. */}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {business?.name ?? t("title")}
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          {business?.description ?? t("subtitle")}
        </p>
      </div>
      <p className="max-w-md rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        {t("stageNotice")}
      </p>
    </div>
  );
}
