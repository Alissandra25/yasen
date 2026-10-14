import { getTranslations } from "next-intl/server";
import { LocationForm } from "@/components/location-form";
import { LocationRow } from "@/components/location-row";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import { requireOwner } from "@/server/session";

export default async function LocationsPage() {
  const user = await requireOwner();
  const t = await getTranslations("locations");
  const [locations, inventory] = await Promise.all([
    listLocations(user.businessId),
    listInventory(user.businessId),
  ]);

  const stats = new Map<number, { positions: number; negative: number }>();
  for (const row of inventory) {
    const existing = stats.get(row.locationId) ?? {
      positions: 0,
      negative: 0,
    };
    if (row.quantity !== 0) existing.positions += 1;
    if (row.quantity < 0) existing.negative += 1;
    stats.set(row.locationId, existing);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("title")}
      </h1>
      <ul className="flex flex-col gap-2">
        {locations.map((location) => (
          <LocationRow
            key={location.id}
            location={location}
            positionCount={stats.get(location.id)?.positions ?? 0}
            negativeCount={stats.get(location.id)?.negative ?? 0}
          />
        ))}
        {locations.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </li>
        )}
      </ul>
      <LocationForm />
    </div>
  );
}
