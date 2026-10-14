"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListedProduct {
  id: number;
  name: string;
  sku: string | null;
}

export function ProductDetailList({
  products,
  selectedId,
  locale,
}: {
  products: ListedProduct[];
  selectedId: number;
  locale: string;
}) {
  const t = useTranslations("products");
  const [query, setQuery] = useState("");

  const visible = query
    ? products.filter((product) => {
        const q = query.trim().toLowerCase();
        return (
          product.name.toLowerCase().includes(q) ||
          (product.sku ? product.sku.toLowerCase().includes(q) : false)
        );
      })
    : products;

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
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
        {visible.map((product) => (
          <li key={product.id}>
            <Link
              href={`/${locale}/products/${product.id}`}
              className={cn(
                "block rounded-lg px-2.5 py-1.5 text-sm",
                product.id === selectedId
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="block truncate">{product.name}</span>
              {product.sku && (
                <span className="block truncate text-xs text-muted-foreground">
                  {product.sku}
                </span>
              )}
            </Link>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-2.5 py-4 text-center text-sm text-muted-foreground">
            {t("noMatches")}
          </li>
        )}
      </ul>
    </div>
  );
}
