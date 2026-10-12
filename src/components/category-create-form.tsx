"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategoryAction,
  type CategoryFormState,
} from "@/server/actions/categories";

const initialState: CategoryFormState = {};

export function CategoryCreateForm({ parentId }: { parentId: number | null }) {
  const t = useTranslations("categories");
  const [state, formAction, isPending] = useActionState(
    createCategoryAction,
    initialState,
  );
  const addLabel = parentId === null ? t("addCategory") : t("addSubcategory");

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <Input
        name="name"
        placeholder={t("nameLabel")}
        required
        className="h-8 max-w-xs"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {addLabel}
      </Button>
      {state.error && (
        <span className="text-xs text-destructive" role="alert">
          {t("invalidInput")}
        </span>
      )}
    </form>
  );
}
