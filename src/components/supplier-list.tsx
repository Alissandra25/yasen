"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SupplierRow } from "@/components/supplier-row";
import { confirmSuppliersReviewedAction } from "@/server/actions/suppliers";
import type { Supplier } from "@/server/services/suppliers";

// suppliers comes straight from the server on every render (no local copy) — unlike
// CategoryManager, this list has no client-only concern (drag reordering) that needs its own
// state, so a create/edit/archive's revalidatePath refresh shows up immediately on its own.
export function SupplierList({ suppliers }: { suppliers: Supplier[] }) {
  const t = useTranslations("suppliers");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const visible = reviewOnly
    ? suppliers.filter((supplier) => supplier.needsReview)
    : suppliers;

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
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={reviewOnly}
            onChange={(event) => setReviewOnly(event.target.checked)}
          />
          {t("needsReviewFilter")}
        </label>
        {selected.size > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={() => void confirmSelected()}
          >
            {t("confirmSelected", { count: selected.size })}
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {visible.map((supplier) => (
          <SupplierRow
            key={supplier.id}
            supplier={supplier}
            selected={selected.has(supplier.id)}
            onToggleSelected={() => toggleSelected(supplier.id)}
          />
        ))}
        {visible.length === 0 && (
          <li className="text-sm text-muted-foreground">{t("empty")}</li>
        )}
      </ul>
    </div>
  );
}
