import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransferList } from "@/components/transfer-list";
import { businessCurrentMonth, formatMonthLabel } from "@/lib/dates";
import { getCurrentBusiness } from "@/server/services/business";
import { listTransfersWithSummary } from "@/server/services/transfers";
import { requireOwner } from "@/server/session";

export default async function TransfersPage() {
  const user = await requireOwner();
  const t = await getTranslations("transfers");
  const locale = await getLocale();
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";

  const transfers = await listTransfersWithSummary(user.businessId);

  const currentMonth = businessCurrentMonth(timezone);
  const transfersThisMonth = transfers.filter(
    (transfer) => transfer.createdAt.toISOString().slice(0, 7) === currentMonth,
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
              count: transfersThisMonth.length,
            })}
          </p>
        </div>
        <Button
          type="button"
          nativeButton={false}
          render={<Link href={`/${locale}/transfers/new`} />}
        >
          <Plus className="size-4" />
          {t("newTransferButton")}
        </Button>
      </div>
      <TransferList transfers={transfers} timezone={timezone} />
    </div>
  );
}
