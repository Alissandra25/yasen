import { Upload } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { ProductCreateDialog } from "@/components/product-create-dialog";
import { ProductList } from "@/components/product-list";
import { getCurrentBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/categories";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import {
  getArchiveCandidateProductIds,
  listCurrentPrices,
  listProducts,
} from "@/server/services/products";
import { listSuppliers } from "@/server/services/suppliers";
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
      options.push({ id: sub.id, label: `${top.name} › ${sub.name}` });
    }
  }
  return options;
}

function buildCategoryBreadcrumbs(
  categories: { id: number; name: string; parentId: number | null }[],
): Map<number, string> {
  const map = new Map<number, string>();
  for (const category of categories) {
    if (category.parentId === null) {
      map.set(category.id, category.name);
    } else {
      const parent = categories.find((c) => c.id === category.parentId);
      map.set(
        category.id,
        parent ? `${parent.name} › ${category.name}` : category.name,
      );
    }
  }
  return map;
}

export default async function ProductsPage() {
  const user = await requireOwner();
  const t = await getTranslations("products");
  const business = await getCurrentBusiness();

  const [
    products,
    categories,
    suppliers,
    archiveCandidateIds,
    locations,
    inventory,
    prices,
  ] = await Promise.all([
    listProducts(user.businessId),
    listCategories(user.businessId),
    listSuppliers(user.businessId),
    getArchiveCandidateProductIds(
      user.businessId,
      business?.archivePeriodProducts ?? 1,
    ),
    listLocations(user.businessId),
    listInventory(user.businessId),
    listCurrentPrices(user.businessId),
  ]);

  const visibleProducts = products.filter((product) => !product.archived);
  const categoryOptions = buildCategoryOptions(categories);
  const categoryBreadcrumbs = buildCategoryBreadcrumbs(categories);
  const supplierOptions = suppliers
    .filter((supplier) => !supplier.archived && !supplier.isSystem)
    .map((supplier) => ({ id: supplier.id, name: supplier.name }));
  // Matches Sales' subtitle convention: top-level categories only, not every subcategory too.
  const topLevelCategoryCount = categories.filter(
    (category) => !category.archived && category.parentId === null,
  ).length;

  const stockByProduct = new Map<number, [number, number][]>();
  for (const row of inventory) {
    const list = stockByProduct.get(row.productId) ?? [];
    list.push([row.locationId, row.quantity]);
    stockByProduct.set(row.productId, list);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", {
              productCount: visibleProducts.length,
              categoryCount: topLevelCategoryCount,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="products/import"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Upload className="size-4" />
            {t("importLink")}
          </Link>
          <ProductCreateDialog
            categories={categoryOptions}
            suppliers={supplierOptions}
          />
        </div>
      </div>
      <ProductList
        products={products}
        categoryBreadcrumbs={categoryBreadcrumbs}
        categories={categoryOptions}
        suppliers={supplierOptions}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          type: location.type,
        }))}
        prices={Array.from(prices.entries())}
        stockByProduct={Array.from(stockByProduct.entries())}
        archiveCandidateIds={archiveCandidateIds}
      />
    </div>
  );
}
