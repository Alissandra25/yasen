import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TransferForm } from "@/components/transfer-form";
import { listCategories } from "@/server/services/categories";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import { listProducts } from "@/server/services/products";
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
    for (const sub of active.filter(
      (category) => category.parentId === top.id,
    )) {
      options.push({ id: sub.id, label: `${top.name} › ${sub.name}` });
    }
  }
  return options;
}

export default async function NewTransferPage() {
  const user = await requireOwner();
  const t = await getTranslations("transfers");
  const locale = await getLocale();

  const [locations, products, categories, inventory] = await Promise.all([
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
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <Link
          href={`/${locale}/transfers`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t("backToAll")}
        </Link>
      </div>
      <TransferForm
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          type: location.type,
        }))}
        products={products
          .filter((product) => !product.archived)
          .map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            categoryId: product.categoryId,
            minStock: product.minStock,
          }))}
        categories={buildCategoryOptions(categories)}
        stockByLocation={Array.from(stockByProduct.entries()).map(
          ([productId, perLocation]) => [
            productId,
            Array.from(perLocation.entries()),
          ],
        )}
      />
    </div>
  );
}
