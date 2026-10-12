import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashSummaryPanel } from "@/components/cash-summary-panel";
import { SalesMatrix } from "@/components/sales-matrix";
import {
  businessCurrentMonth,
  businessToday,
  daysInMonth,
  monthStartDate,
} from "@/lib/dates";
import { getDailyCashSummary } from "@/server/services/cash-adjustments";
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
  searchParams: Promise<{ month?: string; locationId?: string; day?: string }>;
}) {
  const user = await requireOwner();
  const t = await getTranslations("sales");
  const locale = await getLocale();
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";
  const currency = business?.currency ?? "UAH";

  const params = await searchParams;
  const month = params.month ?? businessCurrentMonth(timezone);
  const days = daysInMonth(month);
  const periodStart = monthStartDate(month);
  const periodEnd = days[days.length - 1];
  const day = params.day ?? businessToday(timezone);

  const locations = await listLocations(user.businessId);
  const shopLocations = locations.filter(
    (location) => location.type === "shop",
  );
  const locationId = params.locationId
    ? Number(params.locationId)
    : (shopLocations[0]?.id ?? locations[0]?.id ?? 0);

  const [products, categories, totals, stockAtStart, stockNow, cashSummary] =
    await Promise.all([
      listProducts(user.businessId),
      listCategories(user.businessId),
      getSalesTotals(user.businessId, locationId, periodStart, periodEnd),
      getStockAtPeriodStart(user.businessId, locationId, periodStart),
      getCurrentStock(user.businessId, locationId),
      getDailyCashSummary(user.businessId, locationId, day),
    ]);

  const activeProducts = products.filter((product) => !product.archived);
  const categoryOrder = buildCategoryOrder(categories);

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-full">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
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
          <CashSummaryPanel
            day={day}
            locationId={locationId}
            month={month}
            summary={cashSummary}
            currency={currency}
            locale={locale}
          />
        </CardContent>
      </Card>
    </div>
  );
}
