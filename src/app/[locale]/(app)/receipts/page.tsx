import { getTranslations } from "next-intl/server";
import { PurchaseForm } from "@/components/purchase-form";
import { PurchaseList } from "@/components/purchase-list";
import { getCurrentBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/categories";
import { listProducts } from "@/server/services/products";
import { listPurchasesWithSummary } from "@/server/services/purchases";
import { listLocations } from "@/server/services/locations";
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
      options.push({ id: sub.id, label: `— ${sub.name}` });
    }
  }
  return options;
}

export default async function ReceiptsPage() {
  const user = await requireOwner();
  const t = await getTranslations("receipts");
  const business = await getCurrentBusiness();

  const [purchases, locations, suppliers, products, categories] =
    await Promise.all([
      listPurchasesWithSummary(user.businessId),
      listLocations(user.businessId),
      listSuppliers(user.businessId),
      listProducts(user.businessId),
      listCategories(user.businessId),
    ]);

  const activeSuppliers = suppliers
    .filter((supplier) => !supplier.archived && !supplier.isSystem)
    .map((supplier) => ({ id: supplier.id, name: supplier.name }));
  const activeProducts = products
    .filter((product) => !product.archived)
    .map((product) => ({ id: product.id, name: product.name }));
  const categoryOptions = buildCategoryOptions(categories);

  return (
    <div className="flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", { count: purchases.length })}
        </p>
      </div>
      <PurchaseList
        purchases={purchases}
        timezone={business?.timezone ?? "Europe/Kyiv"}
        currency={business?.currency ?? "UAH"}
      />
      <PurchaseForm
        suppliers={activeSuppliers}
        locations={locations}
        products={activeProducts}
        categories={categoryOptions}
      />
    </div>
  );
}
