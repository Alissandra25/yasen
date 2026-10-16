"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import {
  archiveCategoryAction,
  moveCategoryParentAction,
  renameCategoryAction,
  type CategoryFormState,
} from "@/server/actions/categories";
import { reassignCategoryProductsAction } from "@/server/actions/products";

export interface FlatCategory {
  id: number;
  name: string;
  parentId: number | null;
  productCount: number;
}

const initialState: CategoryFormState = {};

export function CategoryDetailPanel({
  category,
  flatCategories,
}: {
  category: FlatCategory;
  flatCategories: FlatCategory[];
}) {
  const t = useTranslations("categories");
  const locale = useLocale();
  const { showToast } = useToast();
  const [moving, setMoving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<number | "">("");

  const boundRename = renameCategoryAction.bind(null, category.id);
  const [state, formAction, isPending] = useActionState(
    boundRename,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      showToast({ message: t("saved") });
    }
    wasPendingRef.current = isPending;
    // showToast/t are stable across renders; re-running this on every render would re-fire the
    // toast, not just after a real pending → settled transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state]);

  const isTop = category.parentId === null;
  const parent = isTop
    ? null
    : flatCategories.find((c) => c.id === category.parentId);
  const topCategories = flatCategories.filter((c) => c.parentId === null);
  const moveTargets = flatCategories.filter((c) => c.id !== category.id);

  const canArchive = category.productCount === 0;

  async function handleMoveParent(newParentId: string) {
    const parsed = Number(newParentId);
    if (!parsed) return;
    const result = await moveCategoryParentAction(category.id, parsed);
    if (result.ok) {
      showToast({ message: t("movedToast") });
    } else {
      showToast({ message: t("invalidInput") });
    }
  }

  async function handleReassignProducts() {
    if (!moveTarget) return;
    const result = await reassignCategoryProductsAction(
      category.id,
      moveTarget,
    );
    if (result.ok) {
      showToast({ message: t("moveProductsToast") });
      setMoving(false);
      setMoveTarget("");
    } else {
      showToast({ message: t("invalidInput") });
    }
  }

  return (
    <div className="flex w-80 shrink-0 flex-col gap-5 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-xs text-muted-foreground">
          {isTop
            ? t("topCategoryLabel")
            : t("subcategoryIn", { parent: parent?.name ?? "" })}
        </p>
        <h2 className="text-xl font-bold text-foreground">{category.name}</h2>
      </div>

      <form action={formAction} className="flex flex-col gap-2">
        <Label htmlFor="category-detail-name">{t("nameLabel")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="category-detail-name"
            name="name"
            defaultValue={category.name}
            required
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {t("save")}
          </Button>
        </div>
        {state.error && (
          <span className="text-xs text-destructive" role="alert">
            {t("invalidInput")}
          </span>
        )}
      </form>

      {!isTop && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-detail-parent">{t("belongsToLabel")}</Label>
          <select
            id="category-detail-parent"
            defaultValue={category.parentId ?? ""}
            onChange={(event) => void handleMoveParent(event.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {topCategories.map((top) => (
              <option key={top.id} value={top.id}>
                {top.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Link
          href={`/${locale}/products?categoryId=${category.id}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("openInProducts", { count: category.productCount })}
        </Link>

        {!moving ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={moveTargets.length === 0}
            onClick={() => setMoving(true)}
          >
            {isTop ? t("moveProductsButtonTop") : t("moveProductsButtonSub")}
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2.5">
            <Label htmlFor="category-detail-move-target">
              {t("moveProductsTargetLabel")}
            </Label>
            <select
              id="category-detail-move-target"
              value={moveTarget}
              onChange={(event) =>
                setMoveTarget(
                  event.target.value ? Number(event.target.value) : "",
                )
              }
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">—</option>
              {moveTargets.map((target) => {
                const targetParent = flatCategories.find(
                  (c) => c.id === target.parentId,
                );
                return (
                  <option key={target.id} value={target.id}>
                    {targetParent
                      ? `${targetParent.name} › ${target.name}`
                      : target.name}
                  </option>
                );
              })}
            </select>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!moveTarget}
                onClick={() => void handleReassignProducts()}
              >
                {t("moveProductsConfirm")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setMoving(false);
                  setMoveTarget("");
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canArchive}
          className="w-full text-destructive hover:text-destructive disabled:text-muted-foreground"
          onClick={() => {
            void archiveCategoryAction(category.id);
            showToast({
              message: t("archivedToast", { name: category.name }),
            });
          }}
        >
          {isTop ? t("archive") : t("archiveSubcategory")}
        </Button>
        {!canArchive && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("archiveDisabledHint")}
          </p>
        )}
      </div>
    </div>
  );
}
