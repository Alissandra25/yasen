import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierCsvImport } from "@/components/supplier-csv-import";

export default async function SupplierImportPage() {
  const t = await getTranslations("suppliersImport");

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierCsvImport />
        </CardContent>
      </Card>
    </div>
  );
}
