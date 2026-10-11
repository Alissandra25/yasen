import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/server/session";

export default async function LoginPage() {
  const locale = await getLocale();

  const user = await getSessionUser();
  if (user) redirect(`/${locale}`);

  const t = await getTranslations("login");

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-24">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
