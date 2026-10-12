import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierForm } from "@/components/supplier-form";
import { SupplierList } from "@/components/supplier-list";
import { listSuppliers } from "@/server/services/suppliers";
import { requireOwner } from "@/server/session";

export default async function SuppliersPage() {
  const user = await requireOwner();
  const t = await getTranslations("suppliers");
  const all = await listSuppliers(user.businessId);
  // The hidden system supplier (spec 3.11) never appears in the reference list.
  const visible = all.filter(
    (supplier) => !supplier.archived && !supplier.isSystem,
  );

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SupplierList suppliers={visible} />
          <SupplierForm />
        </CardContent>
      </Card>
    </div>
  );
}
