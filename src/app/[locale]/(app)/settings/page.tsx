import { getLocale, getTranslations } from "next-intl/server";
import {
  AccountingSettingsForm,
  RestockSettingsForm,
  ShopAppearanceForm,
} from "@/components/business-settings-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NoteTypeManager } from "@/components/note-type-manager";
import { SettingsNav } from "@/components/settings-nav";
import { ThemeSegmented } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentBusiness } from "@/server/services/business";
import { logoutAction } from "@/server/actions/auth";
import { listNoteTypes } from "@/server/services/note-types";
import { requireOwner } from "@/server/session";

export default async function SettingsPage() {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("settings");
  const tRoles = await getTranslations("roles");
  const tNoteTypes = await getTranslations("noteTypes");
  const [noteTypes, business] = await Promise.all([
    listNoteTypes(user.businessId),
    getCurrentBusiness(),
  ]);

  const shopSection = (
    <ShopAppearanceForm
      name={business?.name ?? ""}
      description={business?.description ?? null}
    />
  );

  const accountingSection = (
    <AccountingSettingsForm
      timezone={business?.timezone ?? "Europe/Kyiv"}
      currency={business?.currency ?? "UAH"}
    />
  );

  const salesSection = (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="font-semibold text-foreground">
            {t("paymentMethodsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("paymentMethodsHint")}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          <li className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
            {t("cashMethod")}
          </li>
          <li className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
            {t("cardMethod")}
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          {t("availableLaterStage")}
        </p>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="font-semibold text-foreground">
            {tNoteTypes("sectionTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tNoteTypes("sectionDescription")}
          </p>
        </div>
        <NoteTypeManager noteTypes={noteTypes} />
      </section>
    </div>
  );

  const restockSection = (
    <RestockSettingsForm
      archivePeriodProducts={business?.archivePeriodProducts ?? 1}
    />
  );

  const usersSection = (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold text-foreground">{t("usersTitle")}</h2>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {user.email.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            {tRoles(user.role)}
          </p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("sellersLabel")}
          </p>
          <p className="text-xs text-muted-foreground">{t("sellersHint")}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button type="button" variant="outline" disabled>
            {t("inviteSellerAction")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("availableLaterVersion")}
          </span>
        </div>
      </div>
    </div>
  );

  const accountSection = (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">{t("profileTitle")}</h2>

        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {user.email.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {tRoles(user.role)}
            </p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            {t("languageLabel")}
          </span>
          <LocaleSwitcher segmented />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            {t("themeLabel")}
          </span>
          <ThemeSegmented />
          <p className="text-xs text-muted-foreground">{t("themeHint")}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">
          {t("changePasswordTitle")}
        </h2>
        <ChangePasswordForm />
      </section>

      <section className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="font-semibold text-foreground">{t("logoutTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("logoutDescription")}
          </p>
        </div>
        <form action={logoutAction.bind(null, locale)}>
          <Button type="submit" variant="outline">
            {t("logoutAction")}
          </Button>
        </form>
      </section>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <SettingsNav
        shop={shopSection}
        accounting={accountingSection}
        sales={salesSection}
        restock={restockSection}
        users={usersSection}
        account={accountSection}
      />
    </div>
  );
}
