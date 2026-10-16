import { getTranslations } from "next-intl/server";
import { LocationForm } from "@/components/location-form";
import { LocationRow } from "@/components/location-row";
import { getCurrentBusiness } from "@/server/services/business";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import { listCurrentPrices } from "@/server/services/products";
import { requireOwner } from "@/server/session";

export default async function LocationsPage() {
  const user = await requireOwner();
  const t = await getTranslations("locations");
  const business = await getCurrentBusiness();
  const [locations, inventory, prices] = await Promise.all([
    listLocations(user.businessId),
    listInventory(user.businessId),
    listCurrentPrices(user.businessId),
  ]);

  const stats = new Map<
    number,
    { positions: number; negative: number; purchaseValue: number }
  >();
  for (const row of inventory) {
    const existing = stats.get(row.locationId) ?? {
      positions: 0,
      negative: 0,
      purchaseValue: 0,
    };
    if (row.quantity !== 0) existing.positions += 1;
    if (row.quantity < 0) existing.negative += 1;
    const price = prices.get(row.productId)?.purchasePrice ?? 0;
    existing.purchaseValue += price * row.quantity;
    stats.set(row.locationId, existing);
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <LocationRow
            key={location.id}
            location={location}
            positionCount={stats.get(location.id)?.positions ?? 0}
            negativeCount={stats.get(location.id)?.negative ?? 0}
            purchaseValue={stats.get(location.id)?.purchaseValue ?? 0}
            currency={business?.currency ?? "UAH"}
          />
        ))}
        {locations.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            {t("empty")}
          </li>
        )}
        <li>
          <LocationForm />
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">{t("cannotDeleteNote")}</p>
    </div>
  );
}
