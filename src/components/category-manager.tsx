"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { reorderCategoriesAction } from "@/server/actions/categories";
import { CategoryCreateForm } from "@/components/category-create-form";
import {
  CategoryDetailPanel,
  type FlatCategory,
} from "@/components/category-detail-panel";
import { CategoryItem } from "@/components/category-item";

export interface CategoryNode {
  id: number;
  name: string;
  productCount: number;
  subcategories: { id: number; name: string; productCount: number }[];
}

// One DndContext per sibling group (top-level categories, and each category's own subcategory
// list) rather than one shared context: this makes a cross-parent drop impossible at the UI
// level too, not just rejected server-side by reorderCategories.
function SortableList<T extends { id: number }>({
  parentId,
  items,
  onReorder,
  renderItem,
}: {
  parentId: number | null;
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(items, oldIndex, newIndex);
    onReorder(next);
    void reorderCategoriesAction(
      parentId,
      next.map((item) => item.id),
    );
  }

  return (
    <DndContext
      id={`categories-${parentId ?? "root"}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">{items.map(renderItem)}</ul>
      </SortableContext>
    </DndContext>
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function CategoryManager({
  initialCategories,
  flatCategories,
}: {
  initialCategories: CategoryNode[];
  flatCategories: FlatCategory[];
}) {
  const t = useTranslations("categories");
  const [categories, setCategories] = useState(initialCategories);
  const [syncedInitial, setSyncedInitial] = useState(initialCategories);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // useState's initial value is only used on mount; after a create/rename/archive action calls
  // revalidatePath, the server re-renders this page and pushes a fresh initialCategories prop
  // into this already-mounted component. Adjusting state during render (React's documented
  // alternative to useEffect+setState for "reset state when a prop changes") picks that up
  // without an extra render-after-commit cycle. Without this, the list would only reflect a
  // create/rename/archive after a full page reload.
  if (initialCategories !== syncedInitial) {
    setSyncedInitial(initialCategories);
    setCategories(initialCategories);
  }

  function reorderSubcategories(
    parentId: number,
    next: { id: number; name: string; productCount: number }[],
  ) {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === parentId
          ? { ...category, subcategories: next }
          : category,
      ),
    );
  }

  function toggleCollapsed(categoryId: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const searchQuery = normalize(search);
  const visibleCategories = searchQuery
    ? categories.filter(
        (category) =>
          normalize(category.name).includes(searchQuery) ||
          category.subcategories.some((sub) =>
            normalize(sub.name).includes(searchQuery),
          ),
      )
    : categories;

  const allTopIds = useMemo(
    () => categories.map((category) => category.id),
    [categories],
  );

  const selectedCategory = selectedId
    ? (flatCategories.find((c) => c.id === selectedId) ?? null)
    : null;

  return (
    <div className="flex gap-6">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("expandAll")}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set(allTopIds))}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("collapseAll")}
          </button>
        </div>

        <SortableList
          parentId={null}
          items={visibleCategories}
          onReorder={setCategories}
          renderItem={(category) => (
            <CategoryItem
              key={category.id}
              category={category}
              isTop
              selected={selectedId === category.id}
              onSelect={() => setSelectedId(category.id)}
              collapsed={collapsed.has(category.id)}
              onToggleCollapsed={() => toggleCollapsed(category.id)}
            >
              <div className="mt-2 ml-6 flex flex-col gap-2">
                <SortableList
                  parentId={category.id}
                  items={category.subcategories}
                  onReorder={(next) => reorderSubcategories(category.id, next)}
                  renderItem={(sub) => (
                    <CategoryItem
                      key={sub.id}
                      category={sub}
                      selected={selectedId === sub.id}
                      onSelect={() => setSelectedId(sub.id)}
                    />
                  )}
                />
                <CategoryCreateForm
                  parentId={category.id}
                  parentName={category.name}
                />
              </div>
            </CategoryItem>
          )}
        />
        <CategoryCreateForm parentId={null} />
        <p className="text-xs text-muted-foreground">{t("keyboardHint")}</p>
      </div>

      {selectedCategory ? (
        <CategoryDetailPanel
          key={selectedCategory.id}
          category={selectedCategory}
          flatCategories={flatCategories}
        />
      ) : (
        <div className="flex w-80 shrink-0 items-start justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("selectPrompt")}
        </div>
      )}
    </div>
  );
}
