"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateBusinessSettingsAction,
  type BusinessSettingsFormState,
} from "@/server/actions/business";

const initialState: BusinessSettingsFormState = {};

// A short, curated list rather than every IANA zone — this business operates from one place
// (spec default: Europe/Kyiv); the others just avoid the field looking hard-coded to one value.
const TIMEZONES = ["Europe/Kyiv", "Europe/Warsaw", "UTC"];

export function ShopAppearanceForm({
  name,
  description,
}: {
  name: string;
  description: string | null;
}) {
  const t = useTranslations("settings");
  const [state, formAction, isPending] = useActionState(
    updateBusinessSettingsAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold text-foreground">{t("shopTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("shopDescription")}</p>
      </div>
      <form
        action={formAction}
        className="flex flex-col divide-y divide-border"
      >
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="business-name">{t("shopNameLabel")}</Label>
          </div>
          <Input id="business-name" name="name" defaultValue={name} required />
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="business-description">{t("taglineLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("taglineHint")}</p>
          </div>
          <Input
            id="business-description"
            name="description"
            defaultValue={description ?? ""}
          />
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label>{t("logoLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("availableLaterStage")}
          </p>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label>{t("brandColorsLabel")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("brandColorsHint")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("availableLaterStage")}
          </p>
        </div>
        {state.error && (
          <p className="pt-3 text-sm text-destructive" role="alert">
            {t("invalidInput")}
          </p>
        )}
        <div className="flex items-center gap-2 pt-3">
          <Button type="submit" disabled={isPending}>
            {t("save")}
          </Button>
          {state.success && (
            <span className="text-sm text-muted-foreground">
              {t("savedInline")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export function AccountingSettingsForm({
  timezone,
  currency,
}: {
  timezone: string;
  currency: string;
}) {
  const t = useTranslations("settings");
  const [state, formAction, isPending] = useActionState(
    updateBusinessSettingsAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold text-foreground">
          {t("accountingTitle")}
        </h2>
      </div>
      <form
        action={formAction}
        className="flex flex-col divide-y divide-border"
      >
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="business-timezone">{t("timezoneLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("timezoneHint")}</p>
          </div>
          <select
            id="business-timezone"
            name="timezone"
            defaultValue={timezone}
            className="h-8 w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="business-currency">{t("currencyLabel")}</Label>
          </div>
          <select
            id="business-currency"
            name="currency"
            defaultValue={currency}
            className="h-8 w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="UAH">{t("currencyUah")}</option>
          </select>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label>{t("vatLabel")}</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("availableLaterStage")}
          </p>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label>{t("supplierTrackingLabel")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("supplierTrackingHint")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("availableLaterStage")}
          </p>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label>{t("monthCloseLabel")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("monthCloseHint")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("availableLaterStage")}
          </p>
        </div>
        {state.error && (
          <p className="pt-3 text-sm text-destructive" role="alert">
            {t("invalidInput")}
          </p>
        )}
        <div className="flex items-center gap-2 pt-3">
          <Button type="submit" disabled={isPending}>
            {t("save")}
          </Button>
          {state.success && (
            <span className="text-sm text-muted-foreground">
              {t("savedInline")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export function RestockSettingsForm({
  archivePeriodProducts,
}: {
  archivePeriodProducts: number;
}) {
  const t = useTranslations("settings");
  const [state, formAction, isPending] = useActionState(
    updateBusinessSettingsAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold text-foreground">{t("restockTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("restockDescription")}
        </p>
      </div>
      <form
        action={formAction}
        className="flex flex-col divide-y divide-border"
      >
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label>{t("velocityThresholdLabel")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("velocityThresholdHint")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("availableLaterStage")}
          </p>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="business-archive-products">
              {t("archiveProductsLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("archiveProductsHint")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="business-archive-products"
              name="archivePeriodProducts"
              type="number"
              min={1}
              max={36}
              defaultValue={archivePeriodProducts}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              {t("monthsUnit")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-2">
          <div>
            <Label>{t("archiveSuppliersLabel")}</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("availableLaterStage")}
          </p>
        </div>
        {state.error && (
          <p className="pt-3 text-sm text-destructive" role="alert">
            {t("invalidInput")}
          </p>
        )}
        <div className="flex items-center gap-2 pt-3">
          <Button type="submit" disabled={isPending}>
            {t("save")}
          </Button>
          {state.success && (
            <span className="text-sm text-muted-foreground">
              {t("savedInline")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
