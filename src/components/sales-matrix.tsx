"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Calendar, Check, ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addDaysToDateString,
  formatInBusinessTimeZone,
  shiftMonth,
  shiftWeek,
} from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ProductNotesPopover } from "@/components/product-notes-popover";
import { recordSalesAction } from "@/server/actions/sales";
import type { MatrixCellTotal } from "@/server/services/sales";
import type { ActiveProductNote } from "@/server/services/product-notes";
import type { SalesView } from "@/app/[locale]/(app)/sales/page";
import { cn } from "@/lib/utils";

type Bucket = "none" | "cash" | "card";

const VIEWS: SalesView[] = ["day", "week", "month"];

interface CategoryOption {
  id: number;
  label: string;
  parentId: number | null;
}

function bucketToPaymentMethod(bucket: Bucket): "cash" | "card" | null {
  return bucket === "none" ? null : bucket;
}

function cellKey(productId: number, day: string, bucket: Bucket) {
  return `${productId}|${day}|${bucket}`;
}

function buildOriginalMap(totals: MatrixCellTotal[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const total of totals) {
    const bucket: Bucket = total.paymentMethod ?? "none";
    map.set(cellKey(total.productId, total.saleDate, bucket), total.quantity);
  }
  return map;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function weekdayIndex(day: string) {
  // UTC parse: date-only strings are never meant to shift by local offset.
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

function isWeekend(day: string) {
  const weekday = weekdayIndex(day);
  return weekday === 0 || weekday === 6;
}

// Negative stock is a critical signal (destructive red, per ui.md); zero stock is a business-rule
// warning (amber), never the brand colour. Reused across the day/week/month stock columns.
function StockQuantity({ value }: { value: number }) {
  if (value < 0) {
    return (
      <Badge variant="destructive" className="font-semibold">
        {value}
      </Badge>
    );
  }
  if (value === 0) {
    return (
      <Badge className="bg-warning font-semibold text-warning-foreground">
        {value}
      </Badge>
    );
  }
  return <span className="text-muted-foreground">{value}</span>;
}

function CategoryPicker({
  categoryOrder,
  checked,
  onChange,
  label,
  allLabel,
  searchPlaceholder,
  clearLabel,
  applyLabel,
}: {
  categoryOrder: CategoryOption[];
  checked: Set<number>;
  onChange: (next: Set<number>) => void;
  label: string;
  allLabel: string;
  searchPlaceholder: string;
  clearLabel: string;
  applyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const allIds = useMemo(
    () => categoryOrder.map((category) => category.id),
    [categoryOrder],
  );
  const tops = categoryOrder.filter((category) => category.parentId === null);
  const childrenOf = (parentId: number) =>
    categoryOrder.filter((category) => category.parentId === parentId);

  const filteredTops = query
    ? tops.filter((top) => {
        const q = normalize(query);
        if (normalize(top.label).includes(q)) return true;
        return childrenOf(top.id).some((sub) =>
          normalize(sub.label).includes(q),
        );
      })
    : tops;

  function toggle(id: number) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function toggleGroup(topId: number) {
    const ids = [topId, ...childrenOf(topId).map((c) => c.id)];
    const allChecked = ids.every((id) => checked.has(id));
    const next = new Set(checked);
    for (const id of ids) {
      if (allChecked) next.delete(id);
      else next.add(id);
    }
    onChange(next);
  }

  const isAll = checked.size === allIds.length;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="font-normal">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold">
              {isAll ? allLabel : checked.size}
            </span>
            <ChevronDown className="size-3.5" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-input bg-transparent pr-2 pl-7 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
            <input
              type="checkbox"
              checked={isAll}
              onChange={() => onChange(isAll ? new Set() : new Set(allIds))}
              className="size-4 rounded border-input accent-primary"
            />
            {allLabel}
          </label>
          {filteredTops.map((top) => (
            <div key={top.id}>
              <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
                <input
                  type="checkbox"
                  checked={checked.has(top.id)}
                  onChange={() => toggleGroup(top.id)}
                  className="size-4 rounded border-input accent-primary"
                />
                {top.label}
              </label>
              {childrenOf(top.id).map((sub) => (
                <label
                  key={sub.id}
                  className="ml-5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(sub.id)}
                    onChange={() => toggle(sub.id)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  {sub.label}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border p-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(new Set())}>
            {clearLabel}
          </Button>
          <PopoverClose
            render={
              <Button size="sm" type="button">
                {applyLabel}
              </Button>
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SalesMatrix({
  view,
  period,
  days,
  today,
  locationId,
  products,
  categoryOrder,
  totals,
  stockAtStart,
  stockNow,
  salePrices,
  noteMonth,
  noteTypes,
  activeNotes,
  currency,
  locale,
  timezone,
  cashSummarySlot,
}: {
  view: SalesView;
  period: string;
  days: string[];
  today: string;
  locationId: number;
  products: {
    id: number;
    name: string;
    sku: string | null;
    categoryId: number;
  }[];
  categoryOrder: CategoryOption[];
  totals: MatrixCellTotal[];
  stockAtStart: [number, number][];
  stockNow: [number, number][];
  salePrices: [number, number][];
  noteMonth: string;
  noteTypes: { id: number; name: string; color: string }[];
  activeNotes: ActiveProductNote[];
  currency: string;
  locale: string;
  timezone: string;
  cashSummarySlot: ReactNode;
}) {
  const t = useTranslations("sales");
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [splitMode, setSplitMode] = useState(false);
  const [checkedCategories, setCheckedCategories] = useState<Set<number>>(
    () => new Set(categoryOrder.map((c) => c.id)),
  );
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(
    () => new Set(),
  );
  const [showOnlyWithSales, setShowOnlyWithSales] = useState(false);
  const [search, setSearch] = useState("");
  const [original, setOriginal] = useState(() => buildOriginalMap(totals));
  const [draft, setDraft] = useState(() => buildOriginalMap(totals));
  const [syncedTotals, setSyncedTotals] = useState(totals);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The debounced autosave runs from a setTimeout, outside React's render cycle — reading
  // `draft`/`original` state directly there would close over whichever render was current when
  // the timer was scheduled, missing the keystroke that triggered it (React applies setDraft
  // asynchronously). Refs sidestep that: setValue updates them synchronously (in the event
  // handler, not during render — mutating during render is a lint error in this project's React
  // Compiler setup), so the timer always sees the latest values no matter when it fires.
  const draftRef = useRef(draft);
  const originalRef = useRef(original);
  const splitModeRef = useRef(splitMode);

  useEffect(() => {
    draftRef.current = draft;
    originalRef.current = original;
    splitModeRef.current = splitMode;
  }, [draft, original, splitMode]);

  // useState's initial value only applies on mount; after a save calls router.refresh(), the
  // server re-renders this page with fresh totals and pushes a new `totals` prop into this
  // already-mounted component. Adjusting state during render (same escape hatch as
  // category-manager.tsx, not useEffect+setState, per this project's react-hooks/set-state-in-effect
  // rule) picks that up immediately instead of only after a full page reload.
  if (totals !== syncedTotals) {
    setSyncedTotals(totals);
    const fresh = buildOriginalMap(totals);
    setOriginal(fresh);
    setDraft(fresh);
  }

  // "/" focuses search unless the user is already typing somewhere (spec 3.5.1).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;
      if (typing) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const stockAtStartMap = useMemo(() => new Map(stockAtStart), [stockAtStart]);
  const stockNowMap = useMemo(() => new Map(stockNow), [stockNow]);
  const salePriceMap = useMemo(() => new Map(salePrices), [salePrices]);
  const notesByProduct = useMemo(() => {
    const map = new Map<number, ActiveProductNote[]>();
    for (const note of activeNotes) {
      const list = map.get(note.productId) ?? [];
      list.push(note);
      map.set(note.productId, list);
    }
    return map;
  }, [activeNotes]);

  const productsWithSales = useMemo(() => {
    const set = new Set<number>();
    for (const total of totals) {
      if (total.quantity !== 0) set.add(total.productId);
    }
    return set;
  }, [totals]);

  function getValue(productId: number, day: string, bucket: Bucket) {
    return draft.get(cellKey(productId, day, bucket)) ?? 0;
  }

  function setValue(
    productId: number,
    day: string,
    bucket: Bucket,
    value: number,
  ) {
    const next = new Map(draftRef.current);
    next.set(cellKey(productId, day, bucket), value);
    draftRef.current = next;
    setDraft(next);
    // Autosave (spec 3.5): every change is saved after a short pause, no explicit Save button.
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void handleSave(), 900);
  }

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function cellTotal(productId: number, day: string) {
    return (
      getValue(productId, day, "none") +
      getValue(productId, day, "cash") +
      getValue(productId, day, "card")
    );
  }

  function rowTotal(productId: number) {
    return days.reduce((sum, day) => sum + cellTotal(productId, day), 0);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(false);

    // Reads the refs, not the `draft`/`original`/`splitMode` state closed over by this render —
    // see the comment by draftRef's declaration. This function is always invoked from the
    // debounce timer in setValue, never directly from render.
    const currentDraft = draftRef.current;
    const currentOriginal = originalRef.current;
    const currentSplitMode = splitModeRef.current;
    const draftValue = (productId: number, day: string, bucket: Bucket) =>
      currentDraft.get(cellKey(productId, day, bucket)) ?? 0;

    const entries: {
      productId: number;
      locationId: number;
      quantity: number;
      saleDate: string;
      paymentMethod: "cash" | "card" | null;
      clientUuid: string;
    }[] = [];

    for (const product of products) {
      for (const day of days) {
        const buckets: Bucket[] = currentSplitMode
          ? ["cash", "card"]
          : ["none", "cash", "card"];
        if (!currentSplitMode) {
          // Combine every bucket's original into one total, write the delta under "none".
          const originalTotal =
            (currentOriginal.get(cellKey(product.id, day, "none")) ?? 0) +
            (currentOriginal.get(cellKey(product.id, day, "cash")) ?? 0) +
            (currentOriginal.get(cellKey(product.id, day, "card")) ?? 0);
          const draftTotal =
            draftValue(product.id, day, "none") +
            draftValue(product.id, day, "cash") +
            draftValue(product.id, day, "card");
          const delta = draftTotal - originalTotal;
          if (delta !== 0) {
            entries.push({
              productId: product.id,
              locationId,
              quantity: delta,
              saleDate: day,
              paymentMethod: null,
              clientUuid: crypto.randomUUID(),
            });
          }
          continue;
        }
        for (const bucket of buckets) {
          const originalValue =
            currentOriginal.get(cellKey(product.id, day, bucket)) ?? 0;
          const delta = draftValue(product.id, day, bucket) - originalValue;
          if (delta !== 0) {
            entries.push({
              productId: product.id,
              locationId,
              quantity: delta,
              saleDate: day,
              paymentMethod: bucketToPaymentMethod(bucket),
              clientUuid: crypto.randomUUID(),
            });
          }
        }
      }
    }

    if (entries.length === 0) {
      setIsSaving(false);
      return;
    }

    const result = await recordSalesAction(entries);
    setIsSaving(false);

    if (!result.ok) {
      setSaveError(true);
      return;
    }

    setSavedAt(new Date());
    const newOriginal = new Map(currentDraft);
    originalRef.current = newOriginal;
    setOriginal(newOriginal);
    router.refresh();
  }

  const searchQuery = normalize(search);
  const matchedGroupIds = new Set(
    categoryOrder
      .filter(
        (category) =>
          searchQuery && normalize(category.label).includes(searchQuery),
      )
      .map((category) => category.id),
  );

  const visibleProducts = products
    .filter((product) => checkedCategories.has(product.categoryId))
    .filter((product) =>
      showOnlyWithSales ? productsWithSales.has(product.id) : true,
    )
    .filter((product) => {
      if (!searchQuery) return true;
      if (matchedGroupIds.has(product.categoryId)) return true;
      return (
        normalize(product.name).includes(searchQuery) ||
        (product.sku ? normalize(product.sku).includes(searchQuery) : false)
      );
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const groups = categoryOrder
    .map((category) => ({
      category,
      products: visibleProducts.filter(
        (product) => product.categoryId === category.id,
      ),
    }))
    .filter((group) => group.products.length > 0);

  // Catalogue size per category, independent of the current filters — matches the mockup's
  // "184 позиції" style count, which doesn't change as you search or narrow the category picker.
  const categoryProductCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const product of products) {
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  function toggleCollapsed(categoryId: number) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const matchedCategoryCount = new Set(groups.map((g) => g.category.id)).size;

  function periodHref(nextPeriod?: string) {
    const params = new URLSearchParams();
    params.set("view", view);
    if (nextPeriod) params.set("period", nextPeriod);
    params.set("locationId", String(locationId));
    return `?${params.toString()}`;
  }

  const prevHref =
    view === "day"
      ? periodHref(addDaysToDateString(period, -1))
      : view === "week"
        ? periodHref(shiftWeek(period, -1))
        : periodHref(shiftMonth(period, -1));
  const nextHref =
    view === "day"
      ? periodHref(addDaysToDateString(period, 1))
      : view === "week"
        ? periodHref(shiftWeek(period, 1))
        : periodHref(shiftMonth(period, 1));
  const todayHref = periodHref();

  const caption = useMemo(() => {
    const fmt = (day: string, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
        new Date(`${day}T00:00:00Z`),
      );
    if (view === "day") {
      return fmt(period, { weekday: "short", day: "numeric", month: "long" });
    }
    if (view === "week") {
      const start = days[0];
      const end = days[days.length - 1];
      return `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short" })}`;
    }
    return fmt(days[0], { month: "long", year: "numeric" });
  }, [view, period, days, locale]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          {VIEWS.map((value) => (
            <Link
              key={value}
              href={`?view=${value}&locationId=${locationId}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`view.${value}`)}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={prevHref} />}
          >
            ←
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold text-foreground capitalize">
            {caption}
          </span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={nextHref} />}
          >
            →
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={todayHref} />}
          >
            {t(`todayButton.${view}`)}
          </Button>
        </div>

        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {isSaving ? (
            t("saving")
          ) : savedAt ? (
            <>
              <Check className="size-3.5 text-success" />
              {t("savedAt", {
                time: formatInBusinessTimeZone(savedAt, timezone, locale, {
                  timeStyle: "short",
                }),
              })}
            </>
          ) : null}
        </span>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                <Calendar className="size-3.5" />
                {t("cashBoxLabel")}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-96 p-4">
            {cashSummarySlot}
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearch("");
            }}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <CategoryPicker
          categoryOrder={categoryOrder}
          checked={checkedCategories}
          onChange={setCheckedCategories}
          label={`${t("categoryLabel")}: `}
          allLabel={t("allCategories")}
          searchPlaceholder={t("categorySearchPlaceholder")}
          clearLabel={t("clearSelection")}
          applyLabel={t("apply")}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showOnlyWithSales}
            onChange={(event) => setShowOnlyWithSales(event.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          {t("showOnlyWithSales")}
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={splitMode}
            onChange={(event) => setSplitMode(event.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          {t("splitPaymentMethod")}
        </label>
      </div>

      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {t("searchSummary", {
            categoryCount: matchedCategoryCount,
            productCount: visibleProducts.length,
          })}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                {t("productColumn")}
              </th>
              {view === "day" ? (
                <>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {t("stockNowColumn")}
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {t("priceColumn")}
                  </th>
                  {splitMode ? (
                    <>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">
                        {t("cashLabel")}
                      </th>
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">
                        {t("cardLabel")}
                      </th>
                    </>
                  ) : (
                    <th className="px-2 py-2 text-center font-medium text-muted-foreground">
                      {t("quantityLabel")}
                    </th>
                  )}
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {t("sumColumn")}
                  </th>
                </>
              ) : (
                <>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {t("stockAtStartColumn")}
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className={cn(
                        "px-1 py-2 text-center font-medium text-muted-foreground",
                        isWeekend(day) && "bg-muted/60",
                        day === today && "bg-accent/40",
                      )}
                    >
                      {new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: view === "week" ? "short" : undefined,
                      }).format(new Date(`${day}T00:00:00Z`))}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                    {t("stockNowColumn")}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const isCollapsed = collapsedCategories.has(group.category.id);
              const hasSales = group.products.some((product) =>
                productsWithSales.has(product.id),
              );
              return (
                <Fragment key={group.category.id}>
                  <tr className="border-b border-border">
                    <td
                      colSpan={view === "day" ? 6 : days.length + 3}
                      className="bg-muted p-0 text-sm font-semibold text-foreground"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(group.category.id)}
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/70"
                      >
                        <ChevronDown
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform",
                            isCollapsed && "-rotate-90",
                          )}
                        />
                        {group.category.label}
                        <span className="font-normal text-muted-foreground">
                          {t("categoryItemCount", {
                            count:
                              categoryProductCounts.get(group.category.id) ?? 0,
                          })}
                        </span>
                        {isCollapsed && hasSales && (
                          <span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-success" />
                            {t("hasSalesInPeriod")}
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed &&
                    group.products.map((product) => {
                      const price = salePriceMap.get(product.id) ?? null;
                      const quantity = rowTotal(product.id);
                      return (
                        <tr
                          key={product.id}
                          className="border-b border-border last:border-b-0 hover:bg-muted/40"
                        >
                          <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium text-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {product.name}
                              <ProductNotesPopover
                                productId={product.id}
                                productName={product.name}
                                month={noteMonth}
                                notes={notesByProduct.get(product.id) ?? []}
                                noteTypes={noteTypes}
                              />
                            </span>
                          </td>
                          {view === "day" ? (
                            <>
                              <td className="px-2 py-1.5 text-right">
                                <StockQuantity
                                  value={stockNowMap.get(product.id) ?? 0}
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right text-muted-foreground">
                                {price !== null
                                  ? formatMoney(price, { currency, locale })
                                  : "—"}
                              </td>
                              {splitMode ? (
                                <td className="px-1 py-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      aria-label={t("cashLabel")}
                                      placeholder="·"
                                      className="h-7 w-12 rounded-md border border-input bg-transparent text-center text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                      value={
                                        getValue(product.id, period, "cash") ||
                                        ""
                                      }
                                      onChange={(event) =>
                                        setValue(
                                          product.id,
                                          period,
                                          "cash",
                                          Number.parseInt(
                                            event.target.value,
                                            10,
                                          ) || 0,
                                        )
                                      }
                                    />
                                    <input
                                      aria-label={t("cardLabel")}
                                      placeholder="·"
                                      className="h-7 w-12 rounded-md border border-input bg-accent/50 text-center text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                      value={
                                        getValue(product.id, period, "card") ||
                                        ""
                                      }
                                      onChange={(event) =>
                                        setValue(
                                          product.id,
                                          period,
                                          "card",
                                          Number.parseInt(
                                            event.target.value,
                                            10,
                                          ) || 0,
                                        )
                                      }
                                    />
                                  </div>
                                </td>
                              ) : (
                                <td className="px-1 py-1 text-center">
                                  <input
                                    aria-label={t("quantityLabel")}
                                    placeholder="·"
                                    className="h-7 w-14 rounded-md border border-input bg-transparent text-center text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                    value={
                                      getValue(product.id, period, "none") || ""
                                    }
                                    onChange={(event) =>
                                      setValue(
                                        product.id,
                                        period,
                                        "none",
                                        Number.parseInt(
                                          event.target.value,
                                          10,
                                        ) || 0,
                                      )
                                    }
                                  />
                                </td>
                              )}
                              <td className="px-2 py-1.5 text-right font-medium text-foreground">
                                {price !== null && quantity > 0
                                  ? formatMoney(price * quantity, {
                                      currency,
                                      locale,
                                    })
                                  : "—"}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 py-1.5 text-right">
                                <StockQuantity
                                  value={stockAtStartMap.get(product.id) ?? 0}
                                />
                              </td>
                              {days.map((day) =>
                                splitMode ? (
                                  <td
                                    key={day}
                                    className={cn(
                                      "px-1 py-1",
                                      isWeekend(day) && "bg-muted/30",
                                    )}
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <input
                                        aria-label={t("cashLabel")}
                                        placeholder="·"
                                        className="h-6 w-10 rounded-md border border-input bg-transparent text-center text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                        value={
                                          getValue(product.id, day, "cash") ||
                                          ""
                                        }
                                        onChange={(event) =>
                                          setValue(
                                            product.id,
                                            day,
                                            "cash",
                                            Number.parseInt(
                                              event.target.value,
                                              10,
                                            ) || 0,
                                          )
                                        }
                                      />
                                      <input
                                        aria-label={t("cardLabel")}
                                        placeholder="·"
                                        className="h-6 w-10 rounded-md border border-input bg-accent/50 text-center text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                        value={
                                          getValue(product.id, day, "card") ||
                                          ""
                                        }
                                        onChange={(event) =>
                                          setValue(
                                            product.id,
                                            day,
                                            "card",
                                            Number.parseInt(
                                              event.target.value,
                                              10,
                                            ) || 0,
                                          )
                                        }
                                      />
                                    </div>
                                  </td>
                                ) : (
                                  <td
                                    key={day}
                                    className={cn(
                                      "px-1 py-1",
                                      isWeekend(day) && "bg-muted/30",
                                    )}
                                  >
                                    <input
                                      aria-label={t("quantityLabel")}
                                      placeholder="·"
                                      className="h-6 w-10 rounded-md border border-input bg-transparent text-center text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                      value={
                                        getValue(product.id, day, "none") || ""
                                      }
                                      onChange={(event) =>
                                        setValue(
                                          product.id,
                                          day,
                                          "none",
                                          Number.parseInt(
                                            event.target.value,
                                            10,
                                          ) || 0,
                                        )
                                      }
                                    />
                                  </td>
                                ),
                              )}
                              <td className="px-2 py-1.5 text-right">
                                <StockQuantity
                                  value={stockNowMap.get(product.id) ?? 0}
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td
                  colSpan={view === "day" ? 6 : days.length + 3}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  {t("noMatches")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {saveError && <Badge variant="destructive">{t("noPriceError")}</Badge>}
    </div>
  );
}
