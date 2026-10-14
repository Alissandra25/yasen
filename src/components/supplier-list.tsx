"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierRow } from "@/components/supplier-row";
import { confirmSuppliersReviewedAction } from "@/server/actions/suppliers";
import type { Supplier } from "@/server/services/suppliers";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

// suppliers comes straight from the server on every render (no local copy) — unlike
// CategoryManager, this list has no client-only concern (drag reordering) that needs its own
// state, so a create/edit/archive's revalidatePath refresh shows up immediately on its own.
export function SupplierList({ suppliers }: { suppliers: Supplier[] }) {
  const t = useTranslations("suppliers");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const searchQuery = normalize(search);
  const visible = suppliers
    .filter((supplier) => (reviewOnly ? supplier.needsReview : true))
    .filter((supplier) => {
      if (!searchQuery) return true;
      const matchesName = normalize(supplier.name).includes(searchQuery);
      const matchesContacts = supplier.contacts
        ? normalize(supplier.contacts).includes(searchQuery)
        : false;
      return matchesName || matchesContacts;
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
    await confirmSuppliersReviewedAction(Array.from(selected));
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={reviewOnly}
          onChange={(event) => setReviewOnly(event.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        {t("needsReviewFilter")}
      </label>
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
        {visible.map((supplier) => (
          <SupplierRow
            key={supplier.id}
            supplier={supplier}
            selected={selected.has(supplier.id)}
            onToggleSelectedAction={() => toggleSelected(supplier.id)}
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
