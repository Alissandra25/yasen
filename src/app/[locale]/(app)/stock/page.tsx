import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const t = await getTranslations("stock");

  const [inventory, categories, locations] = await Promise.all([
    listInventory(user.businessId),
    listCategories(user.businessId),
    listLocations(user.businessId),
  ]);

  const categoryOptions = buildCategoryOptions(categories);

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StockView
            inventory={inventory}
            categories={categoryOptions}
            locations={locations}
          />
        </CardContent>
      </Card>
    </div>
  );
}
