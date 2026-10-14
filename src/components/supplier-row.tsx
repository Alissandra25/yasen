"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import {
  archiveSupplierAction,
  updateSupplierAction,
  type SupplierFormState,
} from "@/server/actions/suppliers";
import type { Supplier } from "@/server/services/suppliers";

const initialState: SupplierFormState = {};

export function SupplierRow({
  supplier,
  selected,
  onToggleSelectedAction,
}: {
  supplier: Supplier;
  selected: boolean;
  onToggleSelectedAction: () => void;
}) {
  const t = useTranslations("suppliers");
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const boundAction = updateSupplierAction.bind(null, supplier.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setEditing(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  if (!editing) {
    return (
      <li
        className={`flex items-center justify-between gap-4 rounded-lg border px-3 py-2 ${
          selected ? "border-primary/40 bg-accent/40" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelectedAction}
            aria-label={t("selectForBulkAction")}
            className="size-4 rounded border-input accent-primary"
          />
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              {supplier.name}
              {supplier.needsReview && (
                <Badge className="bg-warning text-warning-foreground">
                  {t("needsReviewBadge")}
                </Badge>
              )}
            </p>
            {supplier.contacts && (
              <p className="text-xs text-muted-foreground">
                {supplier.contacts}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {t("edit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void archiveSupplierAction(supplier.id);
              showToast({
                message: t("archivedToast", { name: supplier.name }),
              });
            }}
          >
            {t("archive")}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-card px-3 py-2">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`name-${supplier.id}`}>{t("nameLabel")}</Label>
          <Input
            id={`name-${supplier.id}`}
            name="name"
            defaultValue={supplier.name}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`contacts-${supplier.id}`}>
            {t("contactsLabel")}
          </Label>
          <Input
            id={`contacts-${supplier.id}`}
            name="contacts"
            defaultValue={supplier.contacts ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`note-${supplier.id}`}>{t("noteLabel")}</Label>
          <Input
            id={`note-${supplier.id}`}
            name="note"
            defaultValue={supplier.note ?? ""}
          />
        </div>
        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {t("invalidInput")}
          </p>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(false)}
        >
          {t("cancel")}
        </Button>
      </form>
    </li>
  );
}
