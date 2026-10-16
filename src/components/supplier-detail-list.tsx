"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { SupplierCreateDialog } from "@/components/supplier-create-dialog";
import { cn } from "@/lib/utils";

interface ListedSupplier {
  id: number;
  name: string;
  needsReview: boolean;
}

export function SupplierDetailList({
  suppliers,
  selectedId,
  locale,
}: {
  suppliers: ListedSupplier[];
  selectedId: number;
  locale: string;
}) {
  const t = useTranslations("suppliers");
  const [query, setQuery] = useState("");

  const visible = query
    ? suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : suppliers;

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <SupplierCreateDialog />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
      <ul className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-card p-1.5">
        {visible.map((supplier) => (
          <li key={supplier.id}>
            <Link
              href={`/${locale}/suppliers/${supplier.id}`}
              className={cn(
                "block truncate rounded-lg px-2.5 py-1.5 text-sm",
                supplier.id === selectedId
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {supplier.name}
            </Link>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-2.5 py-4 text-center text-sm text-muted-foreground">
            {t("empty")}
          </li>
        )}
      </ul>
    </div>
  );
}
