import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-5xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <PurchaseList
            purchases={purchases}
            timezone={business?.timezone ?? "Europe/Kyiv"}
          />
          <PurchaseForm
            suppliers={activeSuppliers}
            locations={locations}
            products={activeProducts}
            categories={categoryOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
