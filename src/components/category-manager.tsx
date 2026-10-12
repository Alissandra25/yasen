"use client";

import { useState } from "react";
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
import { CategoryItem } from "@/components/category-item";

export interface CategoryNode {
  id: number;
  name: string;
  subcategories: { id: number; name: string }[];
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

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: CategoryNode[];
}) {
  const [categories, setCategories] = useState(initialCategories);

  function reorderSubcategories(
    parentId: number,
    next: { id: number; name: string }[],
  ) {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === parentId
          ? { ...category, subcategories: next }
          : category,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SortableList
        parentId={null}
        items={categories}
        onReorder={setCategories}
        renderItem={(category) => (
          <CategoryItem key={category.id} category={category}>
            <div className="mt-2 ml-6 flex flex-col gap-2">
              <SortableList
                parentId={category.id}
                items={category.subcategories}
                onReorder={(next) => reorderSubcategories(category.id, next)}
                renderItem={(sub) => (
                  <CategoryItem key={sub.id} category={sub} />
                )}
              />
              <CategoryCreateForm parentId={category.id} />
            </div>
          </CategoryItem>
        )}
      />
      <CategoryCreateForm parentId={null} />
    </div>
  );
}
