import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { StocktakeTable } from "@/components/stocktake-table";
import { buttonVariants } from "@/components/ui/button";
import { listCategories } from "@/server/services/categories";
import { listLocations } from "@/server/services/locations";
import { getStocktake, listStocktakeItems } from "@/server/services/stocktakes";
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
    options.push({ id: top.id, label: top.name });
    for (const sub of active.filter(
      (category) => category.parentId === top.id,
    )) {
      options.push({ id: sub.id, label: `— ${sub.name}` });
    }
  }
  return options;
}

export default async function StocktakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOwner();
  const locale = await getLocale();
  const t = await getTranslations("stocktake");
  const { id } = await params;
  const stocktakeId = Number(id);

  const stocktake = await getStocktake(user.businessId, stocktakeId);
  if (!stocktake) notFound();

  const [items, categories, locations] = await Promise.all([
    listStocktakeItems(stocktakeId),
    listCategories(user.businessId),
    listLocations(user.businessId),
  ]);

  const location = locations.find((l) => l.id === stocktake.locationId);

  return (
    <div className="flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/${locale}/stock`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("backLink")}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {t("title")} · {location?.name ?? ""}
          </h1>
          {stocktake.status === "posted" && (
            <p className="text-sm text-success">{t("postedNotice")}</p>
          )}
        </div>
        <a
          href={`/${locale}/stock/stocktake/${stocktakeId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <FileDown className="size-4" />
          {t("exportPdf")}
        </a>
      </div>
      <StocktakeTable
        stocktakeId={stocktakeId}
        items={items}
        categories={buildCategoryOptions(categories)}
      />
    </div>
  );
}
