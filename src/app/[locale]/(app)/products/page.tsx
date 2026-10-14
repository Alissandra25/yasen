import { Upload } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", {
              productCount: visibleProducts.length,
              categoryCount: categoryOptions.length,
            })}
          </p>
        </div>
        <Link
          href={`/${locale}/products/import`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Upload className="size-4" />
          {t("importLink")}
        </Link>
      </div>
      <ProductList
        products={visibleProducts}
        categories={categoryOptions}
        suppliers={supplierOptions}
        archiveCandidateIds={archiveCandidateIds}
      />
      <ProductForm categories={categoryOptions} suppliers={supplierOptions} />
    </div>
  );
}
