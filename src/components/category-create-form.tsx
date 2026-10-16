"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  createCategoryAction,
  type CategoryFormState,
} from "@/server/actions/categories";

const initialState: CategoryFormState = {};

export function CategoryCreateForm({
  parentId,
  parentName,
}: {
  parentId: number | null;
  parentName?: string;
}) {
  const t = useTranslations("categories");
  const [adding, setAdding] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createCategoryAction,
    initialState,
  );
  const addLabel = parentId === null ? t("addCategory") : t("addSubcategory");

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setAdding(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      >
        <Plus className="size-3.5" />
        {parentId === null
          ? t("addCategory")
          : t("addSubcategoryIn", { name: parentName ?? "" })}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <Input
        name="name"
        placeholder={t("nameLabel")}
        required
        autoFocus
        className="h-8 max-w-xs"
        onKeyDown={(event) => {
          if (event.key === "Escape") setAdding(false);
        }}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        {addLabel}
      </button>
      {state.error && (
        <span className="text-xs text-destructive" role="alert">
          {t("invalidInput")}
        </span>
      )}
    </form>
  );
}
