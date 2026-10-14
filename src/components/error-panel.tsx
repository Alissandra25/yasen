"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo-mark";

/**
 * Shared "something broke" look (spec mockup 25: 500 and 404 share one visual, just different
 * text). Kept deliberately generic — error code and retry are optional so the same panel covers
 * a caught render error, a 404, and anything else that needs this chrome.
 */
export function ErrorPanel({
  title,
  description,
  code,
  onRetry,
  retryLabel,
  homeHref,
  homeLabel,
}: {
  title: string;
  description: string;
  code?: string;
  onRetry?: () => void;
  retryLabel?: string;
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <AlertTriangle className="size-10 text-muted-foreground" />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={homeHref} />}
        >
          <LogoMark className="size-4" />
          {homeLabel}
        </Button>
        {onRetry && (
          <Button type="button" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
      {code && <p className="text-xs text-muted-foreground">{code}</p>}
    </div>
  );
}
