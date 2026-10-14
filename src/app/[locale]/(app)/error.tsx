"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ErrorPanel } from "@/components/error-panel";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const locale = useLocale();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPanel
      title={t("title")}
      description={t("description")}
      code={error.digest ? t("code", { code: error.digest }) : undefined}
      onRetryAction={reset}
      retryLabel={t("retry")}
      homeHref={`/${locale}`}
      homeLabel={t("home")}
    />
  );
}
