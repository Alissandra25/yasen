// Stocktake report PDF (spec 4.1).
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { formatInBusinessTimeZone } from "@/lib/dates";
import { loadMessages } from "@/server/load-messages";
import { StocktakeReportDocument } from "@/server/pdf/stocktake-report";
import { getCurrentBusiness } from "@/server/services/business";
import { listLocations } from "@/server/services/locations";
import { getStocktake, listStocktakeItems } from "@/server/services/stocktakes";
import { requireOwner } from "@/server/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
) {
  const user = await requireOwner();
  const { locale, id } = await params;
  const stocktakeId = Number(id);

  const stocktake = await getStocktake(user.businessId, stocktakeId);
  if (!stocktake) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [items, locations, business, messages] = await Promise.all([
    listStocktakeItems(stocktakeId),
    listLocations(user.businessId),
    getCurrentBusiness(),
    loadMessages(locale),
  ]);
  const t = createTranslator({ locale, messages, namespace: "stocktake" });
  const location = locations.find((l) => l.id === stocktake.locationId);

  const discrepancies = items.filter(
    (item) =>
      item.countedQuantity !== null &&
      item.countedQuantity !== item.systemQuantity,
  );
  const shortage = discrepancies.reduce((sum, item) => {
    const diff = (item.countedQuantity ?? 0) - item.systemQuantity;
    return diff < 0 ? sum + diff : sum;
  }, 0);
  const surplus = discrepancies.reduce((sum, item) => {
    const diff = (item.countedQuantity ?? 0) - item.systemQuantity;
    return diff > 0 ? sum + diff : sum;
  }, 0);

  const buffer = await renderToBuffer(
    StocktakeReportDocument({
      businessName: business?.name ?? "Yasen",
      locationName: location?.name ?? "",
      generatedAt: formatInBusinessTimeZone(
        new Date(),
        business?.timezone ?? "Europe/Kyiv",
        locale,
      ),
      items,
      reasonLabels: {
        breakage: t("reason.breakage"),
        shortage: t("reason.shortage"),
        mis_sort: t("reason.mis_sort"),
        other: t("reason.other"),
      },
      columnLabels: {
        product: t("productColumn"),
        sku: t("skuColumn"),
        system: t("systemColumn"),
        counted: t("countedColumn"),
        difference: t("differenceColumn"),
        reason: t("reasonColumn"),
      },
      summaryLabel: t("summary", {
        count: discrepancies.length,
        shortage,
        surplus,
      }),
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="stocktake-${stocktakeId}.pdf"`,
    },
  });
}
