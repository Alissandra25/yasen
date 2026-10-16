import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SupplierDetailList } from "@/components/supplier-detail-list";
import { SupplierDetailPanel } from "@/components/supplier-detail-panel";
import { getCurrentBusiness } from "@/server/services/business";
import { listProducts } from "@/server/services/products";
import { listPurchasesWithSummary } from "@/server/services/purchases";
import { listSuppliers } from "@/server/services/suppliers";
import { requireOwner } from "@/server/session";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("suppliers");
  const { id } = await params;
  const supplierId = Number(id);

  const [business, suppliers, products, purchases] = await Promise.all([
    getCurrentBusiness(),
    listSuppliers(user.businessId),
    listProducts(user.businessId),
    listPurchasesWithSummary(user.businessId),
  ]);

  const supplier = suppliers.find((s) => s.id === supplierId);
  if (!supplier || supplier.isSystem) notFound();

  const supplierProducts = products
    .filter((p) => !p.archived && p.defaultSupplierId === supplierId)
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku }));

  const deliveries = purchases
    .filter((p) => p.supplierId === supplierId)
    .map((p) => ({
      id: p.id,
      createdAt: p.createdAt.toISOString().slice(0, 10),
      totalAmount: p.totalAmount,
    }));

  return (
    <div className="flex gap-6 px-6 py-8">
      <SupplierDetailList
        suppliers={suppliers
          .filter((s) => !s.archived && !s.isSystem)
          .map((s) => ({ id: s.id, name: s.name, needsReview: s.needsReview }))}
        selectedId={supplierId}
        locale={locale}
      />
      <div className="flex-1">
        <h1 className="sr-only">{t("title")}</h1>
        <SupplierDetailPanel
          supplier={supplier}
          products={supplierProducts}
          deliveries={deliveries}
          currency={business?.currency ?? "UAH"}
          locale={locale}
        />
      </div>
    </div>
  );
}
