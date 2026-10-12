import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CategoryManager,
  type CategoryNode,
} from "@/components/category-manager";
import { listCategories } from "@/server/services/categories";
import { requireOwner } from "@/server/session";

export default async function CategoriesPage() {
  const user = await requireOwner();
  const t = await getTranslations("categories");
  const all = await listCategories(user.businessId);

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
    .map((category) => ({
      id: category.id,
      name: category.name,
      subcategories: (byParent.get(category.id) ?? []).map((sub) => ({
        id: sub.id,
        name: sub.name,
      })),
    }));

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryManager initialCategories={tree} />
        </CardContent>
      </Card>
    </div>
  );
}
