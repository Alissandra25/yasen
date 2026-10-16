import { getTranslations } from "next-intl/server";
import {
  CategoryManager,
  type CategoryNode,
} from "@/components/category-manager";
import { listCategories } from "@/server/services/categories";
import { listProducts } from "@/server/services/products";
import { requireOwner } from "@/server/session";

export default async function CategoriesPage() {
  const user = await requireOwner();
  const t = await getTranslations("categories");
  const [all, products] = await Promise.all([
    listCategories(user.businessId),
    listProducts(user.businessId),
  ]);

  const productCounts = new Map<number, number>();
  for (const product of products) {
    if (product.archived) continue;
    productCounts.set(
      product.categoryId,
      (productCounts.get(product.categoryId) ?? 0) + 1,
    );
  }

  const visible = all.filter((category) => !category.archived);
  const byParent = new Map<number, typeof visible>();
  for (const category of visible) {
    if (category.parentId === null) continue;
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }

  const tree: CategoryNode[] = visible
    .filter((category) => category.parentId === null)
    .map((category) => {
      const subcategories = byParent.get(category.id) ?? [];
      const ownCount = productCounts.get(category.id) ?? 0;
      const subCount = subcategories.reduce(
        (sum, sub) => sum + (productCounts.get(sub.id) ?? 0),
        0,
      );
      return {
        id: category.id,
        name: category.name,
        productCount: ownCount + subCount,
        subcategories: subcategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
          productCount: productCounts.get(sub.id) ?? 0,
        })),
      };
    });

  const subcategoryCount = tree.reduce(
    (sum, category) => sum + category.subcategories.length,
    0,
  );

  const flatCategories = visible.map((category) => ({
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    productCount: productCounts.get(category.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", {
            categoryCount: tree.length,
            subcategoryCount,
          })}
        </p>
      </div>
      <CategoryManager
        initialCategories={tree}
        flatCategories={flatCategories}
      />
    </div>
  );
}
