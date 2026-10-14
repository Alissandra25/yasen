import { Upload } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { SupplierForm } from "@/components/supplier-form";
import { SupplierList } from "@/components/supplier-list";
import { listSuppliers } from "@/server/services/suppliers";
import { requireOwner } from "@/server/session";

export default async function SuppliersPage() {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("suppliers");
  const all = await listSuppliers(user.businessId);
  // The hidden system supplier (spec 3.11) never appears in the reference list.
  const visible = all.filter(
    (supplier) => !supplier.archived && !supplier.isSystem,
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <Link
          href={`/${locale}/suppliers/import`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Upload className="size-4" />
          {t("importLink")}
        </Link>
      </div>
      <SupplierList suppliers={visible} />
      <SupplierForm />
    </div>
  );
}
