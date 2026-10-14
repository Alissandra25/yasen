"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDaysToDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { setCashAdjustmentAction } from "@/server/actions/cash-adjustments";
import type { DailyCashSummary } from "@/server/services/cash-adjustments";

export function CashSummaryPanel({
  day,
  locationId,
  month,
  summary,
  currency,
  locale,
}: {
  day: string;
  locationId: number;
  month: string;
  summary: DailyCashSummary;
  currency: string;
  locale: string;
}) {
  const t = useTranslations("cashSummary");
  const router = useRouter();
  const moneyOptions = { currency, locale };

  const [discountRaw, setDiscountRaw] = useState(
    summary.adjustmentAmount === 0
      ? ""
      : String(-summary.adjustmentAmount / 100),
  );
  const [note, setNote] = useState(summary.adjustmentNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<"error" | "saved" | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    const result = await setCashAdjustmentAction({
      locationId,
      date: day,
      discountAmountRaw: discountRaw,
      note: note.trim() || null,
    });

    setIsSaving(false);
    setMessage(result.ok ? "saved" : "error");
  }

  function goToDay(nextDay: string) {
    router.push(`?month=${month}&locationId=${locationId}&day=${nextDay}`);
  }

  const caption = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${day}T00:00:00Z`));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("previousDay")}
          onClick={() => goToDay(addDaysToDateString(day, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex flex-col items-center text-center">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("title")}
          </h3>
          <span className="text-sm font-medium text-foreground capitalize">
            {caption}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("nextDay")}
          onClick={() => goToDay(addDaysToDateString(day, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("cash")}</dt>
          <dd className="text-foreground">
            {formatMoney(summary.cash, moneyOptions)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("card")}</dt>
          <dd className="text-foreground">
            {formatMoney(summary.card, moneyOptions)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("grossTotal")}</dt>
          <dd className="text-foreground">
            {formatMoney(summary.grossTotal, moneyOptions)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("netTotal")}</dt>
          <dd className="text-base font-bold text-foreground">
            {formatMoney(summary.netTotal, moneyOptions)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="discount-amount">{t("discountLabel")}</Label>
          <Input
            id="discount-amount"
            className="w-28"
            value={discountRaw}
            onChange={(event) => setDiscountRaw(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="discount-note">{t("noteLabel")}</Label>
          <Input
            id="discount-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {t("save")}
        </Button>
      </div>

      {message === "error" && (
        <p className="text-sm text-destructive">{t("invalidInput")}</p>
      )}
      {message === "saved" && (
        <p className="text-sm text-muted-foreground">{t("saved")}</p>
      )}
    </div>
  );
}
