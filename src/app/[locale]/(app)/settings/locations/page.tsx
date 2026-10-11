import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationForm } from "@/components/location-form";
import { LocationRow } from "@/components/location-row";
import { listLocations } from "@/server/services/locations";
import { requireOwner } from "@/server/session";

export default async function LocationsPage() {
  const user = await requireOwner();
  const t = await getTranslations("locations");
  const locations = await listLocations(user.businessId);

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ul className="flex flex-col gap-2">
            {locations.map((location) => (
              <LocationRow key={location.id} location={location} />
            ))}
            {locations.length === 0 && (
              <li className="text-sm text-muted-foreground">{t("empty")}</li>
            )}
          </ul>
          <LocationForm />
        </CardContent>
      </Card>
    </div>
  );
}
