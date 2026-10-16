import { Upload } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { SupplierCreateDialog } from "@/components/supplier-create-dialog";
import { SupplierList } from "@/components/supplier-list";
import { businessToday } from "@/lib/dates";
import { getCurrentBusiness } from "@/server/services/business";
import { listProducts } from "@/server/services/products";
import { listPurchasesWithSummary } from "@/server/services/purchases";
import { listSuppliers } from "@/server/services/suppliers";
import { requireOwner } from "@/server/session";

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

export default async function SuppliersPage() {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("suppliers");
  const business = await getCurrentBusiness();
  const timezone = business?.timezone ?? "Europe/Kyiv";

  const [all, products, purchases] = await Promise.all([
    listSuppliers(user.businessId),
    listProducts(user.businessId),
    listPurchasesWithSummary(user.businessId),
  ]);
  // The hidden system supplier (spec 3.11) never appears in the reference list.
  const visible = all.filter(
    (supplier) => !supplier.archived && !supplier.isSystem,
  );
  const archivedCount = all.filter(
    (supplier) => supplier.archived && !supplier.isSystem,
  ).length;

  const today = new Date(`${businessToday(timezone)}T00:00:00Z`);
  const cutoff = new Date(today.getTime() - THREE_MONTHS_MS);
  const longWithoutDeliveryCutoff = new Date(
    today.getTime() - 3 * THREE_MONTHS_MS,
  );

  const productCountBySupplier = new Map<number, number>();
  for (const product of products) {
    if (product.archived || product.defaultSupplierId === null) continue;
    productCountBySupplier.set(
      product.defaultSupplierId,
      (productCountBySupplier.get(product.defaultSupplierId) ?? 0) + 1,
    );
  }

  const lastDeliveryBySupplier = new Map<number, Date>();
  const purchased3moBySupplier = new Map<number, number>();
  for (const purchase of purchases) {
    const existing = lastDeliveryBySupplier.get(purchase.supplierId);
    if (!existing || purchase.createdAt > existing) {
      lastDeliveryBySupplier.set(purchase.supplierId, purchase.createdAt);
    }
    if (purchase.createdAt >= cutoff) {
      purchased3moBySupplier.set(
        purchase.supplierId,
        (purchased3moBySupplier.get(purchase.supplierId) ?? 0) +
          purchase.totalAmount,
      );
    }
  }

  const supplierRows = visible.map((supplier) => ({
    supplier,
    productCount: productCountBySupplier.get(supplier.id) ?? 0,
    lastDeliveryAt: lastDeliveryBySupplier.get(supplier.id) ?? null,
    purchased3mo: purchased3moBySupplier.get(supplier.id) ?? 0,
    longWithoutDelivery:
      (lastDeliveryBySupplier.get(supplier.id) ?? null) === null
        ? false
        : (lastDeliveryBySupplier.get(supplier.id) as Date) <
          longWithoutDeliveryCutoff,
  }));

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { count: visible.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/suppliers/import`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Upload className="size-4" />
            {t("importLink")}
          </Link>
          <SupplierCreateDialog />
        </div>
      </div>
      <SupplierList
        rows={supplierRows}
        archivedSuppliers={all.filter((s) => s.archived && !s.isSystem)}
        archivedCount={archivedCount}
        currency={business?.currency ?? "UAH"}
        timezone={timezone}
      />
    </div>
  );
}
