import { getLocale } from "next-intl/server";
import { CashSummaryPanel } from "@/components/cash-summary-panel";
import { SalesMatrix } from "@/components/sales-matrix";
import {
  businessCurrentMonth,
  businessCurrentWeekStart,
  businessToday,
  daysInMonth,
  daysInWeek,
  monthStartDate,
} from "@/lib/dates";
import { getDailyCashSummary } from "@/server/services/cash-adjustments";
import { listCategories } from "@/server/services/categories";
import { listLocations } from "@/server/services/locations";
import { listNoteTypes } from "@/server/services/note-types";
import { listProducts } from "@/server/services/products";
import { listActiveProductNotes } from "@/server/services/product-notes";
import {
  getCurrentStock,
  getSalesTotals,
  getStockAtPeriodStart,
  listCurrentSalePrices,
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
  const order: { id: number; label: string; parentId: number | null }[] = [];
  for (const top of active.filter((category) => category.parentId === null)) {
    order.push({ id: top.id, label: top.name, parentId: null });
    for (const sub of active.filter(
      (category) => category.parentId === top.id,
    )) {
      order.push({ id: sub.id, label: sub.name, parentId: top.id });
    }
  }
  return order;
}

const VIEWS = ["day", "week", "month"] as const;
export type SalesView = (typeof VIEWS)[number];

function resolveView(raw: string | undefined): SalesView {
  return (VIEWS as readonly string[]).includes(raw ?? "")
    ? (raw as SalesView)
    : "day";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    period?: string;
    locationId?: string;
    day?: string;
  }>;
}) {
  const user = await requireOwner();
  const locale = await getLocale();
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";
  const currency = business?.currency ?? "UAH";

  const params = await searchParams;
  const view = resolveView(params.view);
  const today = businessToday(timezone);

  let days: string[];
  let period: string;
  if (view === "day") {
    period = params.period ?? today;
    days = [period];
  } else if (view === "week") {
    period = params.period ?? businessCurrentWeekStart(timezone);
    days = daysInWeek(period);
  } else {
    period = params.period ?? businessCurrentMonth(timezone);
    days = daysInMonth(period);
  }
  const periodStart = view === "month" ? monthStartDate(period) : days[0];
  const periodEnd = days[days.length - 1];
  const day = params.day ?? (view === "day" ? period : today);

  const locations = await listLocations(user.businessId);
  const shopLocations = locations.filter(
    (location) => location.type === "shop",
  );
  const locationId = params.locationId
    ? Number(params.locationId)
    : (shopLocations[0]?.id ?? locations[0]?.id ?? 0);

  const [
    products,
    categories,
    totals,
    stockAtStart,
    stockNow,
    cashSummary,
    salePrices,
    noteTypes,
  ] = await Promise.all([
    listProducts(user.businessId),
    listCategories(user.businessId),
    getSalesTotals(user.businessId, locationId, periodStart, periodEnd),
    getStockAtPeriodStart(user.businessId, locationId, periodStart),
    getCurrentStock(user.businessId, locationId),
    getDailyCashSummary(user.businessId, locationId, day),
    listCurrentSalePrices(user.businessId, periodEnd),
    listNoteTypes(user.businessId),
  ]);

  const activeProducts = products.filter((product) => !product.archived);
  const categoryOrder = buildCategoryOrder(categories);
  const locationName =
    locations.find((location) => location.id === locationId)?.name ?? "";
  // Dots next to the product name show the notes active for the shown period's month (spec
  // 3.5.1) — every view's `days[0]` is a real date, so its month covers day/week/month alike.
  const noteMonth = days[0].slice(0, 7);
  const activeNotes = await listActiveProductNotes(
    user.businessId,
    activeProducts.map((product) => product.id),
    noteMonth,
  );

  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-6">
      <SalesMatrix
        view={view}
        period={period}
        days={days}
        today={today}
        locationId={locationId}
        locationName={locationName}
        products={activeProducts.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          categoryId: product.categoryId,
        }))}
        categoryOrder={categoryOrder}
        totals={totals}
        stockAtStart={Array.from(stockAtStart.entries())}
        stockNow={Array.from(stockNow.entries())}
        salePrices={Array.from(salePrices.entries())}
        noteMonth={noteMonth}
        noteTypes={noteTypes}
        activeNotes={activeNotes}
        currency={currency}
        locale={locale}
        timezone={timezone}
        cashBoxDay={day}
        cashBoxAmount={cashSummary.netTotal}
        cashSummarySlot={
          <CashSummaryPanel
            day={day}
            locationId={locationId}
            month={period}
            summary={cashSummary}
            currency={currency}
            locale={locale}
          />
        }
      />
    </div>
  );
}
