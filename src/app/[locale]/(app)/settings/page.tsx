import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = await getTranslations("settings");

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("changePasswordTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("referenceDataTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link
            href={`/${locale}/settings/locations`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("locationsLink")}
          </Link>
          <Link
            href={`/${locale}/settings/categories`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("categoriesLink")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
