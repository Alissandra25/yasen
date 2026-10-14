import { getLocale, getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/change-password-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NoteTypeManager } from "@/components/note-type-manager";
import { ThemeSegmented } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";
import { listNoteTypes } from "@/server/services/note-types";
import { requireOwner } from "@/server/session";

// Account settings (profile, language, theme, password) live here. Business settings (timezone,
// currency, brand colours, …) will join this page once they have a UI — they're Stage 4.
// Reference data (locations/categories/suppliers/products) lives in the sidebar's References
// group — it isn't a "setting", it's day-to-day data the owner maintains.
export default async function SettingsPage() {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("settings");
  const tRoles = await getTranslations("roles");
  const tNoteTypes = await getTranslations("noteTypes");
  const noteTypes = await listNoteTypes(user.businessId);

  return (
    <div className="flex max-w-2xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("title")}
      </h1>

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
        </div>
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
}
