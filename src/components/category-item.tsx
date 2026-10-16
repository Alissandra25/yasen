"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function CategoryItem({
  category,
  isTop,
  selected,
  onSelect,
  collapsed,
  onToggleCollapsed,
  children,
}: {
  category: { id: number; name: string; productCount: number };
  isTop?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("categories");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/item rounded-lg border px-2 py-1.5",
        selected ? "border-primary bg-accent" : "border-border bg-card",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("dragHandle")}
          className="cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        {isTop && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={t("toggleCollapse")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                collapsed && "-rotate-90",
              )}
            />
          </button>
        )}

        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "flex flex-1 items-center gap-2 text-left text-sm text-foreground",
            isTop && "font-semibold",
          )}
        >
          {category.name}
          <span className="text-xs font-normal text-muted-foreground">
            {t("itemCount", { count: category.productCount })}
          </span>
        </button>

        <button
          type="button"
          onClick={onSelect}
          aria-label={t("editCategory")}
          className="text-muted-foreground opacity-0 hover:text-foreground group-hover/item:opacity-100"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
      {!collapsed && children}
    </li>
  );
}
