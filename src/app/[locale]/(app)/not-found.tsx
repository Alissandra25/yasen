import { getLocale, getTranslations } from "next-intl/server";
import { ErrorPanel } from "@/components/error-panel";

export default async function AppNotFound() {
  const locale = await getLocale();
  const t = await getTranslations("errors");

  return (
    <ErrorPanel
      title={t("notFoundTitle")}
      description={t("notFoundDescription")}
      homeHref={`/${locale}`}
      homeLabel={t("home")}
    />
  );
}
