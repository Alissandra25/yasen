import { getLocale, getTranslations } from "next-intl/server";
import { StartStocktakeButton } from "@/components/start-stocktake-button";
import { StockView } from "@/components/stock-view";
import { listCategories } from "@/server/services/categories";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
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

  const [inventory, categories, locations] = await Promise.all([
    listInventory(user.businessId),
    listCategories(user.businessId),
    listLocations(user.businessId),
  ]);

  const categoryOptions = buildCategoryOptions(categories);

  return (
    <div className="flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <StartStocktakeButton locale={locale} locations={locations} />
      </div>
      <StockView
        inventory={inventory}
        categories={categoryOptions}
        locations={locations}
      />
    </div>
  );
}
