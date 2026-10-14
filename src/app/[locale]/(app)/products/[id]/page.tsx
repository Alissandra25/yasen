import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductDetailList } from "@/components/product-detail-list";
import { ProductDetailPanel } from "@/components/product-detail-panel";
import { businessCurrentMonth } from "@/lib/dates";
import { getCurrentBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/categories";
import { listInventory } from "@/server/services/inventory";
import { listNoteTypes } from "@/server/services/note-types";
import { listActiveProductNotes } from "@/server/services/product-notes";
import { listPriceHistory, listProducts } from "@/server/services/products";
import { listSuppliers } from "@/server/services/suppliers";
import { requireOwner } from "@/server/session";

function categoryBreadcrumb(
  categoryId: number,
  categories: { id: number; name: string; parentId: number | null }[],
): string {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return "";
  if (category.parentId === null) return category.name;
  const parent = categories.find((c) => c.id === category.parentId);
  return parent ? `${parent.name} > ${category.name}` : category.name;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("products");
  const { id } = await params;
  const productId = Number(id);

  const [business, products, categories, suppliers, inventory, noteTypes] =
    await Promise.all([
      getCurrentBusiness(),
      listProducts(user.businessId),
      listCategories(user.businessId),
      listSuppliers(user.businessId),
      listInventory(user.businessId),
      listNoteTypes(user.businessId),
    ]);

  const product = products.find((p) => p.id === productId);
  if (!product) notFound();

  const noteMonth = businessCurrentMonth(business?.timezone ?? "Europe/Kyiv");
  const [priceHistory, activeNotes] = await Promise.all([
    listPriceHistory(productId),
    listActiveProductNotes(user.businessId, [productId], noteMonth),
  ]);

  const stockByLocation = inventory
    .filter((row) => row.productId === productId)
    .map((row) => ({
      locationId: row.locationId,
      locationName: row.locationName,
      quantity: row.quantity,
    }));

  return (
    <div className="flex max-w-5xl gap-6 px-6 py-8">
      <ProductDetailList
        products={products
          .filter((p) => !p.archived)
          .map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
        selectedId={productId}
        locale={locale}
      />
      <div className="flex-1">
        <h1 className="sr-only">{t("title")}</h1>
        <ProductDetailPanel
          product={product}
          breadcrumb={categoryBreadcrumb(product.categoryId, categories)}
          categories={categories
            .filter((c) => !c.archived)
            .map((c) => ({ id: c.id, label: c.name }))}
          suppliers={suppliers
            .filter((s) => !s.archived && !s.isSystem)
            .map((s) => ({ id: s.id, name: s.name }))}
          stockByLocation={stockByLocation}
          priceHistory={priceHistory}
          noteMonth={noteMonth}
          noteTypes={noteTypes}
          activeNotes={activeNotes}
          currency={business?.currency ?? "UAH"}
          locale={locale}
        />
      </div>
    </div>
  );
}
