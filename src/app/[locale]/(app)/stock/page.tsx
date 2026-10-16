import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartStocktakeButton } from "@/components/start-stocktake-button";
import { StockView } from "@/components/stock-view";
import { formatMoneyBare } from "@/lib/money";
import { listCategories } from "@/server/services/categories";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import { listCurrentPrices } from "@/server/services/products";
import { requireOwner } from "@/server/session";

function buildCategoryOptions(
  categories: {
    id: number;
    name: string;
    parentId: number | null;
    archived: boolean;
  }[],
) {
  const active = categories.filter((category) => !category.archived);
  const options: { id: number; label: string }[] = [];
  for (const top of active.filter((category) => category.parentId === null)) {
    options.push({ id: top.id, label: top.name });
    for (const sub of active.filter(
      (category) => category.parentId === top.id,
    )) {
      options.push({ id: sub.id, label: `— ${sub.name}` });
    }
  }
  return options;
}

export default async function StockPage() {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("stock");
  const [inventory, categories, locations, prices] = await Promise.all([
    listInventory(user.businessId),
    listCategories(user.businessId),
    listLocations(user.businessId),
    listCurrentPrices(user.businessId),
  ]);

  const categoryOptions = buildCategoryOptions(categories);

  const productCount = new Set(inventory.map((row) => row.productId)).size;
  const purchaseValue = inventory.reduce((sum, row) => {
    const price = prices.get(row.productId)?.purchasePrice ?? 0;
    return sum + price * row.quantity;
  }, 0);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", {
              count: productCount,
              amount: formatMoneyBare(purchaseValue, { locale }),
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/${locale}/stock/adjustments`} />}
          >
            <History className="size-4" />
            {t("adjustmentsHistoryLink")}
          </Button>
          <StartStocktakeButton locale={locale} locations={locations} />
        </div>
      </div>
      <StockView
        inventory={inventory}
        categories={categoryOptions}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          type: location.type,
        }))}
      />
    </div>
  );
}
