import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { TransferForm } from "@/components/transfer-form";
import { TransferList } from "@/components/transfer-list";
import { getCurrentBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/categories";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import { listProducts } from "@/server/services/products";
import { listTransfersWithSummary } from "@/server/services/transfers";
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

export default async function TransfersPage() {
  const user = await requireOwner();
  const t = await getTranslations("transfers");
  const business = await getCurrentBusiness();

  const [transfers, locations, products, categories, inventory] =
    await Promise.all([
      listTransfersWithSummary(user.businessId),
      listLocations(user.businessId),
      listProducts(user.businessId),
      listCategories(user.businessId),
      listInventory(user.businessId),
    ]);

  const stockByProduct = new Map<number, Map<number, number>>();
  for (const row of inventory) {
    const existing = stockByProduct.get(row.productId) ?? new Map();
    existing.set(row.locationId, row.quantity);
    stockByProduct.set(row.productId, existing);
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-5xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <TransferList
            transfers={transfers}
            timezone={business?.timezone ?? "Europe/Kyiv"}
          />
          <TransferForm
            locations={locations}
            products={products
              .filter((product) => !product.archived)
              .map((product) => ({
                id: product.id,
                name: product.name,
                categoryId: product.categoryId,
              }))}
            categories={buildCategoryOptions(categories)}
            stockByLocation={Array.from(stockByProduct.entries()).map(
              ([productId, perLocation]) => [
                productId,
                Array.from(perLocation.entries()),
              ],
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
