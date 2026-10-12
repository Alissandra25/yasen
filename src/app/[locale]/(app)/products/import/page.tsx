import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductCsvImport } from "@/components/product-csv-import";

export default async function ProductImportPage() {
  const t = await getTranslations("productsImport");

  return (
    <div className="flex flex-col gap-6 px-6 py-10">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductCsvImport />
        </CardContent>
      </Card>
    </div>
  );
}
