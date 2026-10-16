// Goods receipt document PDF (spec 13.6).
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { formatInBusinessTimeZone } from "@/lib/dates";
import { currencyLabel, formatMoneyBare } from "@/lib/money";
import { loadMessages } from "@/server/load-messages";
import { ReceiptDocument } from "@/server/pdf/receipt-document";
import { getCurrentBusiness } from "@/server/services/business";
import { getPurchaseWithItems } from "@/server/services/purchases";
import { requireOwner } from "@/server/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
) {
  const user = await requireOwner();
  const { locale, id } = await params;
  const purchaseId = Number(id);

  const result = await getPurchaseWithItems(user.businessId, purchaseId);
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { purchase, items } = result;

  const [business, messages] = await Promise.all([
    getCurrentBusiness(),
    loadMessages(locale),
  ]);
  const t = createTranslator({ locale, messages, namespace: "receipts" });
  const currency = business?.currency ?? "UAH";
  const unit = currencyLabel(currency, locale);

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.purchasePrice,
    0,
  );

  const buffer = await renderToBuffer(
    ReceiptDocument({
      businessName: business?.name ?? "Yasen",
      supplierName: purchase.supplierName,
      postedAt: formatInBusinessTimeZone(
        purchase.createdAt,
        business?.timezone ?? "Europe/Kyiv",
        locale,
        { dateStyle: "long", timeStyle: "short" },
      ),
      items: items.map((item) => ({
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        locationName: item.locationName,
        quantity: item.quantity,
        purchasePrice: formatMoneyBare(item.purchasePrice, { locale }),
        salePrice:
          item.salePrice !== null
            ? formatMoneyBare(item.salePrice, { locale })
            : "—",
        sum: formatMoneyBare(item.quantity * item.purchasePrice, { locale }),
      })),
      columnLabels: {
        product: t("lineProductLabel"),
        location: t("locationsColumn"),
        quantity: t("quantityLabel"),
        purchasePrice: `${t("purchasePriceLabel")}, ${unit}`,
        salePrice: `${t("salePriceLabel")}, ${unit}`,
        sum: `${t("sumColumn")}, ${unit}`,
      },
      totalLabel: t("totalRow"),
      totalAmount: `${formatMoneyBare(totalAmount, { locale })} ${unit}`,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${purchaseId}.pdf"`,
    },
  });
}
