import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ReceiptForm } from "@/components/receipt-form";
import { businessToday } from "@/lib/dates";
import { getCurrentBusiness } from "@/server/services/business";
import { listCategories } from "@/server/services/categories";
import { listInventory } from "@/server/services/inventory";
import { listLocations } from "@/server/services/locations";
import { listCurrentPrices, listProducts } from "@/server/services/products";
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
    for (const sub of active.filter(
      (category) => category.parentId === top.id,
    )) {
      options.push({ id: sub.id, label: `${top.name} › ${sub.name}` });
    }
  }
  return options;
}

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string }>;
}) {
  const user = await requireOwner();
  const t = await getTranslations("receipts");
  const locale = await getLocale();
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";
  const { supplierId } = await searchParams;

  const [locations, suppliers, products, categories, inventory, prices] =
    await Promise.all([
      listLocations(user.businessId),
      listSuppliers(user.businessId),
      listProducts(user.businessId),
      listCategories(user.businessId),
      listInventory(user.businessId),
      listCurrentPrices(user.businessId),
    ]);

  const stockByProduct = new Map<number, [number, string][]>();
  for (const row of inventory) {
    const list = stockByProduct.get(row.productId) ?? [];
    list.push([row.quantity, row.locationName]);
    stockByProduct.set(row.productId, list);
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <Link
          href={`/${locale}/receipts`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t("backToAll")}
        </Link>
      </div>
      <ReceiptForm
        suppliers={suppliers
          .filter((supplier) => !supplier.archived && !supplier.isSystem)
          .map((supplier) => ({ id: supplier.id, name: supplier.name }))}
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
          }))}
        categories={buildCategoryOptions(categories)}
        stockByProduct={Array.from(stockByProduct.entries())}
        currentPrices={Array.from(prices.entries())}
        today={businessToday(timezone)}
        currency={business?.currency ?? "UAH"}
        locale={locale}
        initialSupplierId={supplierId ? Number(supplierId) : null}
      />
    </div>
  );
}
