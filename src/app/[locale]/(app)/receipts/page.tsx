import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseList } from "@/components/purchase-list";
import { businessCurrentMonth, formatMonthLabel } from "@/lib/dates";
import { formatMoneyBare } from "@/lib/money";
import { getCurrentBusiness } from "@/server/services/business";
import { listPurchasesWithSummary } from "@/server/services/purchases";
import { requireOwner } from "@/server/session";

export default async function ReceiptsPage() {
  const user = await requireOwner();
  const t = await getTranslations("receipts");
  const locale = await getLocale();
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";

  const purchases = await listPurchasesWithSummary(user.businessId);

  const currentMonth = businessCurrentMonth(timezone);
  const purchasesThisMonth = purchases.filter(
    (purchase) => purchase.createdAt.toISOString().slice(0, 7) === currentMonth,
  );
  const monthTotal = purchasesThisMonth.reduce(
    (sum, purchase) => sum + purchase.totalAmount,
    0,
  );

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("listSubtitle", {
              month: formatMonthLabel(currentMonth, locale).toLowerCase(),
              count: purchasesThisMonth.length,
              amount: formatMoneyBare(monthTotal, { locale }),
            })}
          </p>
        </div>
        <Button
          type="button"
          nativeButton={false}
          render={<Link href={`/${locale}/receipts/new`} />}
        >
          <Plus className="size-4" />
          {t("newReceiptButton")}
        </Button>
      </div>
      <PurchaseList purchases={purchases} timezone={timezone} />
    </div>
  );
}
