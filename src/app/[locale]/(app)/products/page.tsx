import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "@/components/product-form";
import { ProductList } from "@/components/product-list";
import { getCurrentBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/categories";
import {
  getArchiveCandidateProductIds,
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
      options.push({ id: sub.id, label: `— ${sub.name}` });
    }
  }
  return options;
}

export default async function ProductsPage() {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("products");
  const business = await getCurrentBusiness();

  const [products, categories, suppliers, archiveCandidateIds] =
    await Promise.all([
      listProducts(user.businessId),
      listCategories(user.businessId),
      listSuppliers(user.businessId),
      getArchiveCandidateProductIds(
        user.businessId,
        business?.archivePeriodProducts ?? 1,
      ),
    ]);

  const visibleProducts = products.filter((product) => !product.archived);
  const categoryOptions = buildCategoryOptions(categories);
  const supplierOptions = suppliers
    .filter((supplier) => !supplier.archived && !supplier.isSystem)
    .map((supplier) => ({ id: supplier.id, name: supplier.name }));

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-4xl">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{t("title")}</CardTitle>
          <Link
            href={`/${locale}/products/import`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("importLink")}
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ProductList
            products={visibleProducts}
            categories={categoryOptions}
            suppliers={supplierOptions}
            archiveCandidateIds={archiveCandidateIds}
          />
          <ProductForm
            categories={categoryOptions}
            suppliers={supplierOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
