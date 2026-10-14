"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/toast-provider";
import {
  archiveCategoryAction,
  renameCategoryAction,
  type CategoryFormState,
} from "@/server/actions/categories";

const initialState: CategoryFormState = {};

export function CategoryItem({
  category,
  children,
}: {
  category: { id: number; name: string; productCount: number };
  children?: React.ReactNode;
}) {
  const t = useTranslations("categories");
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });
  const boundRename = renameCategoryAction.bind(null, category.id);
  const [state, formAction, isPending] = useActionState(
    boundRename,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setEditing(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border bg-card px-3 py-2 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("dragHandle")}
                className="cursor-grab touch-none text-muted-foreground"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-4" />
              </button>
            }
          />
          <TooltipContent>{t("dragHandle")}</TooltipContent>
        </Tooltip>

        {!editing ? (
          <span className="flex flex-1 items-center gap-2 text-sm text-foreground">
            {category.name}
            <span className="text-xs font-normal text-muted-foreground">
              {t("itemCount", { count: category.productCount })}
            </span>
          </span>
        ) : (
          <form action={formAction} className="flex flex-1 items-center gap-2">
            <Input
              name="name"
              defaultValue={category.name}
              required
              className="h-7"
            />
            {state.error && (
              <span className="text-xs text-destructive" role="alert">
                {t("invalidInput")}
              </span>
            )}
            <Button type="submit" size="xs" disabled={isPending}>
              {t("save")}
            </Button>
          </form>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? t("cancel") : t("rename")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              void archiveCategoryAction(category.id);
              showToast({
                message: t("archivedToast", { name: category.name }),
              });
            }}
          >
            {t("archive")}
          </Button>
        </div>
      </div>
      {children}
    </li>
  );
}
