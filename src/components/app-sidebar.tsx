import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { countNegativeInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import type { SessionUser } from "@/server/session";

export async function AppSidebar({ user }: { user: SessionUser }) {
  const locale = await getLocale();
  const t = await getTranslations("nav");
  const tRoles = await getTranslations("roles");

  const [locations, negativeStockCount] = await Promise.all([
    listLocations(user.businessId),
    countNegativeInventory(user.businessId),
  ]);
  const shopLocations = locations.filter(
    (location) => location.type === "shop",
  );
  const defaultLocationId = (shopLocations[0] ?? locations[0])?.id ?? null;

  return (
    <Suspense fallback={null}>
      <AppSidebarNav
        locale={locale}
        brandName={t("home")}
        dailyLabel={t("dailyGroup")}
        referencesLabel={t("referencesGroup")}
        settingsLabel={t("settings")}
        logoutLabel={t("logout")}
        closeMenuLabel={t("closeMenu")}
        salesLabel={t("salesLink")}
        receiptsLabel={t("receiptsLink")}
        transfersLabel={t("transfersLink")}
        stockLabel={t("stockLink")}
        productsLabel={t("productsLink")}
        categoriesLabel={t("categoriesLink")}
        suppliersLabel={t("suppliersLink")}
        locationsLabel={t("locationsLink")}
        locationSwitcherLabel={t("locationSwitcherLabel")}
        negativeStockCount={negativeStockCount}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
        }))}
        defaultLocationId={defaultLocationId}
        userInitial={user.email.slice(0, 1).toUpperCase()}
        userRoleLabel={tRoles(user.role)}
      />
    </Suspense>
  );
}
