"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductRow } from "@/components/product-row";
import { confirmProductsReviewedAction } from "@/server/actions/products";
import type { Product } from "@/server/services/products";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

// products comes straight from the server on every render (no local copy), same reasoning as
// SupplierList: only the ephemeral filter/selection state below is client-only.
export function ProductList({
  products,
  categories,
  suppliers,
  archiveCandidateIds,
}: {
  products: Product[];
  categories: { id: number; label: string }[];
  suppliers: { id: number; name: string }[];
  archiveCandidateIds: number[];
}) {
  const t = useTranslations("products");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [candidateOnly, setCandidateOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const candidateSet = useMemo(
    () => new Set(archiveCandidateIds),
    [archiveCandidateIds],
  );

  const searchQuery = normalize(search);
  const visible = products.filter((product) => {
    if (categoryFilter && String(product.categoryId) !== categoryFilter) {
      return false;
    }
    if (reviewOnly && !product.needsReview) return false;
    if (candidateOnly && !candidateSet.has(product.id)) return false;
    if (searchQuery) {
      const matchesName = normalize(product.name).includes(searchQuery);
      const matchesSku = product.sku
        ? normalize(product.sku).includes(searchQuery)
        : false;
      if (!matchesName && !matchesSku) return false;
    }
    return true;
  });

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function confirmSelected() {
    await confirmProductsReviewedAction(Array.from(selected));
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={reviewOnly}
            onChange={(event) => setReviewOnly(event.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          {t("needsReviewFilter")}
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={candidateOnly}
            onChange={(event) => setCandidateOnly(event.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          {t("archiveCandidateFilter")}
        </label>
      </div>
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-accent px-3 py-2">
          <span className="text-sm font-medium text-accent-foreground">
            {t("selectedCount", { count: selected.size })}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => void confirmSelected()}
          >
            {t("confirmSelected", { count: selected.size })}
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {visible.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            categories={categories}
            suppliers={suppliers}
            isArchiveCandidate={candidateSet.has(product.id)}
            selected={selected.has(product.id)}
            onToggleSelectedAction={() => toggleSelected(product.id)}
          />
        ))}
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </li>
        )}
      </ul>
    </div>
  );
}
