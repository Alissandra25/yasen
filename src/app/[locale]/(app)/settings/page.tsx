import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function SettingsPage() {
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
    </div>
  );
}
