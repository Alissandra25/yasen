"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/use-online-status";

/**
 * Shown on every page except Sales when the browser goes offline (spec: "Зв'язок із сервером"
 * mockup) — Sales has its own inline connection-status pill and keeps working offline (append-only
 * matrix), everywhere else a save genuinely won't go through until the connection returns.
 */
export function OfflineBanner() {
  const t = useTranslations("offlineBanner");
  const locale = useLocale();
  const pathname = usePathname();
  const isOnline = useOnlineStatus();

  const isSalesPage = pathname.split("/").filter(Boolean).pop() === "sales";
  if (isOnline || isSalesPage) return null;

  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 bg-warning/20 px-4 py-2 text-sm text-warning-foreground">
      <WifiOff className="size-4 shrink-0" />
      <span>
        {t("message")}{" "}
        <Link
          href={`/${locale}/sales`}
          className="font-medium underline underline-offset-2"
        >
          {t("salesLink")}
        </Link>
      </span>
    </div>
  );
}
