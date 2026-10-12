import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesMatrix } from "@/components/sales-matrix";
import { businessCurrentMonth, daysInMonth, monthStartDate } from "@/lib/dates";
import { listCategories } from "@/server/services/categories";
import { listLocations } from "@/server/services/locations";
import { listProducts } from "@/server/services/products";
import {
  getCurrentStock,
  getSalesTotals,
  getStockAtPeriodStart,
} from "@/server/services/sales";
import { getCurrentBusiness } from "@/server/services/business";
import { requireOwner } from "@/server/session";

function buildCategoryOrder(
  categories: {
    id: number;
    name: string;
    parentId: number | null;
    archived: boolean;
  }[],
) {
  const active = categories.filter((category) => !category.archived);
  const order: { id: number; label: string }[] = [];
  for (const top of active.filter((category) => category.parentId === null)) {
    order.push({ id: top.id, label: top.name });
    for (const sub of active.filter(
      (category) => category.parentId === top.id,
    )) {
      order.push({ id: sub.id, label: sub.name });
    }
  }
  return order;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; locationId?: string }>;
}) {
  const user = await requireOwner();
  const t = await getTranslations("sales");
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";

  const params = await searchParams;
  const month = params.month ?? businessCurrentMonth(timezone);
  const days = daysInMonth(month);
  const periodStart = monthStartDate(month);
  const periodEnd = days[days.length - 1];

  const locations = await listLocations(user.businessId);
  const shopLocations = locations.filter(
    (location) => location.type === "shop",
  );
  const locationId = params.locationId
    ? Number(params.locationId)
    : (shopLocations[0]?.id ?? locations[0]?.id ?? 0);

  const [products, categories, totals, stockAtStart, stockNow] =
    await Promise.all([
      listProducts(user.businessId),
      listCategories(user.businessId),
      getSalesTotals(user.businessId, locationId, periodStart, periodEnd),
      getStockAtPeriodStart(user.businessId, locationId, periodStart),
      getCurrentStock(user.businessId, locationId),
    ]);

  const activeProducts = products.filter((product) => !product.archived);
  const categoryOrder = buildCategoryOrder(categories);

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-full">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesMatrix
            month={month}
            days={days}
            locations={shopLocations.length > 0 ? shopLocations : locations}
            locationId={locationId}
            products={activeProducts.map((product) => ({
              id: product.id,
              name: product.name,
              categoryId: product.categoryId,
            }))}
            categoryOrder={categoryOrder}
            totals={totals}
            stockAtStart={Array.from(stockAtStart.entries())}
            stockNow={Array.from(stockNow.entries())}
          />
        </CardContent>
      </Card>
    </div>
  );
}
