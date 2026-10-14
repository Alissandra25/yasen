import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";
import { LogoMark } from "@/components/logo-mark";
import { getCurrentBusiness } from "@/server/services/business";
import { getSessionUser } from "@/server/session";

export default async function LoginPage() {
  const locale = await getLocale();

  const user = await getSessionUser();
  if (user) redirect(`/${locale}`);

  const t = await getTranslations("login");
  const business = await getCurrentBusiness();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-24">
      <div className="flex items-center gap-2">
        <LogoMark className="size-7" />
        <span className="font-logo text-xl font-semibold tracking-tight text-foreground">
          {business?.name ?? t("title")}
        </span>
      </div>
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
