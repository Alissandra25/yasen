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
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addDaysToDateString,
  formatDayLabel,
  formatDayShort,
  formatInBusinessTimeZone,
  formatMonthLabel,
  formatWeekdayShort,
  formatWeekRangeLabel,
  shiftMonth,
  shiftWeek,
} from "@/lib/dates";
import { currencyLabel, formatMoney, formatMoneyBare } from "@/lib/money";
import { useOnlineStatus } from "@/lib/use-online-status";
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

interface ProductOption {
  id: number;
  name: string;
  sku: string | null;
  categoryId: number;
}

type FlatRow =
  | {
      kind: "category";
      category: CategoryOption;
      count: number;
      hasSales: boolean;
      collapsed: boolean;
    }
  | { kind: "subcategory"; category: CategoryOption; count: number }
  | { kind: "product"; product: ProductOption };

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

// Connection-status pill (spec: "Зв'язок із сервером" mockup) retries a failed send on this
// schedule, in seconds, then holds at the last value.
const RETRY_DELAYS_SEC = [2, 5, 10, 30];

/**
 * How many matrix cells currently differ from the last-saved snapshot — same one-entry-per-delta
 * counting rule as the save itself (one per bucket when split, one combined entry otherwise), so
 * the "N changes on this device" pill always matches what a save would actually send.
 */
function countDirtyCells(
  products: { id: number }[],
  days: string[],
  draft: Map<string, number>,
  original: Map<string, number>,
  splitMode: boolean,
): number {
  let count = 0;
  for (const product of products) {
    for (const day of days) {
      if (splitMode) {
        for (const bucket of ["cash", "card"] as Bucket[]) {
          const key = cellKey(product.id, day, bucket);
          if ((draft.get(key) ?? 0) !== (original.get(key) ?? 0)) count++;
        }
      } else {
        const buckets: Bucket[] = ["none", "cash", "card"];
        const draftTotal = buckets.reduce(
          (sum, bucket) =>
            sum + (draft.get(cellKey(product.id, day, bucket)) ?? 0),
          0,
        );
        const originalTotal = buckets.reduce(
          (sum, bucket) =>
            sum + (original.get(cellKey(product.id, day, bucket)) ?? 0),
          0,
        );
        if (draftTotal !== originalTotal) count++;
      }
    }
  }
  return count;
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

function stripTrailingDot(value: string) {
  return value.replace(/\.(?=\s|$)/gu, "");
}

function shortDayMonth(day: string, locale: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return stripTrailingDot(
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(date),
  );
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

function ShowFilterMenu({
  onlyWithSales,
  onChange,
  prefixLabel,
  allLabel,
  onlyWithSalesLabel,
}: {
  onlyWithSales: boolean;
  onChange: (value: boolean) => void;
  prefixLabel: string;
  allLabel: string;
  onlyWithSalesLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="font-normal">
            <span className="text-muted-foreground">{prefixLabel}</span>
            <span className="font-semibold">
              {onlyWithSales ? onlyWithSalesLabel : allLabel}
            </span>
            <ChevronDown className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={onlyWithSales ? "withSales" : "all"}
          onValueChange={(value) => onChange(value === "withSales")}
        >
          <DropdownMenuRadioItem value="all">{allLabel}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="withSales">
            {onlyWithSalesLabel}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const inputBaseClass =
  "rounded-md border border-input bg-transparent text-center text-xs outline-none focus-visible:border-2 focus-visible:border-ring focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50";
const cardInputClass = "bg-accent/40";

export function SalesMatrix({
  view,
  period,
  days,
  today,
  locationId,
  locationName,
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
  cashBoxDay,
  cashBoxAmount,
  cashSummarySlot,
}: {
  view: SalesView;
  period: string;
  days: string[];
  today: string;
  locationId: number;
  locationName: string;
  products: ProductOption[];
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
  cashBoxDay: string;
  cashBoxAmount: number;
  cashSummarySlot: ReactNode;
}) {
  const t = useTranslations("sales");
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [splitMode, setSplitMode] = useState(true);
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
  const [showSavingIndicator, setShowSavingIndicator] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const isOnline = useOnlineStatus();
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [reconnectToast, setReconnectToast] = useState<number | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountdownInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const retryAttemptRef = useRef(0);
  const isOnlineRef = useRef(isOnline);
  const justReconnectedRef = useRef(false);
  const reconnectToastTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Browser online/offline detection (spec: "Зв'язок із сервером" mockup). Autosave itself
  // keeps working while offline — entries just stay pending on the device (see handleSave) —
  // this only drives the status pill and the retry/reconnect flow.
  useEffect(() => {
    const wasOnline = isOnlineRef.current;
    isOnlineRef.current = isOnline;
    if (!wasOnline && isOnline) {
      // Just reconnected: flush whatever accumulated while offline and show the "back online"
      // toast once that flush settles (handleSave reads justReconnectedRef to know to show it).
      justReconnectedRef.current = true;
      void handleSave();
    }
    // handleSave is defined below and stable enough for this transition-only effect; re-running
    // it on every handleSave identity change would refire on unrelated renders instead of only
    // on an actual online/offline transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  useEffect(() => {
    return () => {
      if (savingIndicatorTimer.current)
        clearTimeout(savingIndicatorTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (retryCountdownInterval.current)
        clearInterval(retryCountdownInterval.current);
      if (reconnectToastTimer.current)
        clearTimeout(reconnectToastTimer.current);
    };
  }, []);

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

  const pendingChangeCount = useMemo(
    () => countDirtyCells(products, days, draft, original, splitMode),
    [products, days, draft, original, splitMode],
  );

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

  function clearRetryState() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (retryCountdownInterval.current)
      clearInterval(retryCountdownInterval.current);
    retryAttemptRef.current = 0;
    setServerUnreachable(false);
    setRetryCountdown(0);
  }

  function scheduleRetry() {
    const delaySec =
      RETRY_DELAYS_SEC[
        Math.min(retryAttemptRef.current, RETRY_DELAYS_SEC.length - 1)
      ];
    retryAttemptRef.current += 1;
    setServerUnreachable(true);
    setRetryCountdown(delaySec);

    if (retryCountdownInterval.current)
      clearInterval(retryCountdownInterval.current);
    retryCountdownInterval.current = setInterval(() => {
      setRetryCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => void handleSave(), delaySec * 1000);
  }

  function retryNow() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (retryCountdownInterval.current)
      clearInterval(retryCountdownInterval.current);
    void handleSave();
  }

  async function handleSave() {
    // Offline: leave everything pending on the device rather than attempting (and failing) a
    // fetch — the reconnect effect flushes it once the browser reports `online` again.
    if (!isOnlineRef.current) {
      return;
    }

    setSaveError(false);
    if (savingIndicatorTimer.current)
      clearTimeout(savingIndicatorTimer.current);
    // Only show "Відправляємо…" if the request is still in flight after 0.5s, so a normal fast
    // save doesn't flash it (spec: "Зв'язок із сервером" mockup).
    savingIndicatorTimer.current = setTimeout(
      () => setShowSavingIndicator(true),
      500,
    );

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
      if (savingIndicatorTimer.current)
        clearTimeout(savingIndicatorTimer.current);
      setShowSavingIndicator(false);
      justReconnectedRef.current = false;
      return;
    }

    let result: Awaited<ReturnType<typeof recordSalesAction>>;
    try {
      result = await recordSalesAction(entries);
    } catch {
      // A thrown fetch, not a rejection the server returned deliberately — the server (or the
      // connection to it) is unreachable even though the browser still thinks it's online.
      if (savingIndicatorTimer.current)
        clearTimeout(savingIndicatorTimer.current);
      setShowSavingIndicator(false);
      scheduleRetry();
      return;
    }

    if (savingIndicatorTimer.current)
      clearTimeout(savingIndicatorTimer.current);
    setShowSavingIndicator(false);
    clearRetryState();

    if (!result.ok) {
      setSaveError(true);
      setRejectedCount(entries.length);
      justReconnectedRef.current = false;
      return;
    }

    setRejectedCount(0);
    const newOriginal = new Map(currentDraft);
    originalRef.current = newOriginal;
    setOriginal(newOriginal);

    if (justReconnectedRef.current) {
      justReconnectedRef.current = false;
      setReconnectToast(entries.length);
      if (reconnectToastTimer.current)
        clearTimeout(reconnectToastTimer.current);
      reconnectToastTimer.current = setTimeout(
        () => setReconnectToast(null),
        4000,
      );
    }
    setSavedAt(new Date());
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

  // Catalogue size per category, independent of the current filters — matches the mockup's
  // "184 позиції" style count, which doesn't change as you search or narrow the category picker.
  const categoryProductCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const product of products) {
      map.set(product.categoryId, (map.get(product.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const childrenByParent = useMemo(() => {
    const map = new Map<number, CategoryOption[]>();
    for (const category of categoryOrder) {
      if (category.parentId === null) continue;
      const list = map.get(category.parentId) ?? [];
      list.push(category);
      map.set(category.parentId, list);
    }
    return map;
  }, [categoryOrder]);

  const productsByCategory = useMemo(() => {
    const map = new Map<number, ProductOption[]>();
    for (const product of visibleProducts) {
      const list = map.get(product.categoryId) ?? [];
      list.push(product);
      map.set(product.categoryId, list);
    }
    return map;
  }, [visibleProducts]);

  function toggleCollapsed(categoryId: number) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  // Flattens the category tree (top → subcategories → products) into one list of rows so it can
  // be virtualized — category hierarchy (spec 3.5.1) means a subcategory nests under its top
  // category, never sits beside it as a sibling section.
  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    const tops = categoryOrder.filter((category) => category.parentId === null);
    for (const top of tops) {
      const subs = childrenByParent.get(top.id) ?? [];
      const directProducts = productsByCategory.get(top.id) ?? [];
      const subEntries = subs.map(
        (sub) => [sub, productsByCategory.get(sub.id) ?? []] as const,
      );
      const totalMatching =
        directProducts.length +
        subEntries.reduce((sum, [, list]) => sum + list.length, 0);
      if (totalMatching === 0) continue;

      const allProductsInTop = [
        ...directProducts,
        ...subEntries.flatMap(([, list]) => list),
      ];
      const hasSales = allProductsInTop.some((product) =>
        productsWithSales.has(product.id),
      );
      const catalogueCount =
        (categoryProductCounts.get(top.id) ?? 0) +
        subs.reduce(
          (sum, sub) => sum + (categoryProductCounts.get(sub.id) ?? 0),
          0,
        );
      const collapsed = collapsedCategories.has(top.id);
      rows.push({
        kind: "category",
        category: top,
        count: catalogueCount,
        hasSales,
        collapsed,
      });
      if (collapsed) continue;

      for (const product of directProducts) {
        rows.push({ kind: "product", product });
      }
      for (const [sub, subProducts] of subEntries) {
        if (subProducts.length === 0) continue;
        rows.push({
          kind: "subcategory",
          category: sub,
          count: categoryProductCounts.get(sub.id) ?? 0,
        });
        for (const product of subProducts) {
          rows.push({ kind: "product", product });
        }
      }
    }
    return rows;
  }, [
    categoryOrder,
    childrenByParent,
    productsByCategory,
    collapsedCategories,
    productsWithSales,
    categoryProductCounts,
  ]);

  const matchedCategoryCount = new Set(
    flatRows
      .filter((row) => row.kind === "category" || row.kind === "subcategory")
      .map((row) => row.category.id),
  ).size;

  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (flatRows[index]?.kind === "product" ? 40 : 34),
    overscan: 24,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // "Ще N категорій нижче" (spec 3.5.1's long-list hint): count the distinct top-level
  // categories whose rows haven't scrolled into view yet, so the hint stays accurate instead of
  // a static guess.
  const categoriesBelowCount = useMemo(() => {
    const lastVisibleIndex =
      virtualRows.length > 0 ? virtualRows[virtualRows.length - 1].index : -1;
    const seen = new Set<number>();
    for (let i = lastVisibleIndex + 1; i < flatRows.length; i += 1) {
      const row = flatRows[i];
      if (row.kind === "category") seen.add(row.category.id);
    }
    return seen.size;
  }, [flatRows, virtualRows]);

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

  const caption =
    view === "day"
      ? formatDayLabel(period, locale)
      : view === "week"
        ? formatWeekRangeLabel(period, locale)
        : formatMonthLabel(period, locale);

  // Column layout: the day view flexes to fill the available width (the product column takes
  // the slack); week/month have a fixed-width product column plus one fixed-width column per
  // day, so they scroll horizontally instead (spec 3.5.2/3.5.3 — up to 31 day columns in month).
  const dayColumns = splitMode
    ? ["minmax(240px,1fr)", "88px", "92px", "72px", "72px", "108px"]
    : ["minmax(240px,1fr)", "88px", "92px", "96px", "108px"];
  // Split mode gives cash/card their own narrow sub-column per day (side by side, like the
  // mockup), so a day takes twice the columns but each is about half as wide.
  const dayColumnWidth = splitMode
    ? view === "week"
      ? 46
      : 28
    : view === "week"
      ? 92
      : 48;
  const daysPerColumnCount = splitMode ? 2 : 1;
  // Month's product names get more room (~360px, per the mockup) since that view has no spare
  // width to truncate gracefully with 31 narrow day columns already filling the row.
  const productColumnWidth = view === "month" ? 360 : 300;
  const stockStartColumnWidth = 80;
  const stockNowColumnWidth = 88;
  const weekMonthColumns = [
    `${productColumnWidth}px`,
    `${stockStartColumnWidth}px`,
    ...days.flatMap(() =>
      Array.from({ length: daysPerColumnCount }, () => `${dayColumnWidth}px`),
    ),
    `${stockNowColumnWidth}px`,
  ];
  const gridTemplateColumns = (
    view === "day" ? dayColumns : weekMonthColumns
  ).join(" ");
  const gridWidth =
    view === "day"
      ? "100%"
      : `${
          productColumnWidth +
          stockStartColumnWidth +
          days.length * daysPerColumnCount * dayColumnWidth +
          stockNowColumnWidth
        }px`;

  function isFutureDay(day: string) {
    return day > today;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("previousPeriod")}
              nativeButton={false}
              render={<Link href={prevHref} />}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-semibold text-foreground">
              {caption}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("nextPeriod")}
              nativeButton={false}
              render={<Link href={nextHref} />}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={todayHref} />}
          >
            {t(`todayButton.${view}`)}
          </Button>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span>
          {t("subtitle", {
            location: locationName,
            productCount: products.length,
            categoryCount: categoryOrder.filter((c) => c.parentId === null)
              .length,
          })}
        </span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1">
          {reconnectToast !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
              <Check className="size-3.5" />
              {t("reconnectedToast", { count: reconnectToast })}
            </span>
          ) : serverUnreachable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
              {t("serverUnreachablePill", { seconds: retryCountdown })}
              <button
                type="button"
                onClick={retryNow}
                className="font-medium underline underline-offset-2"
              >
                {t("retryNow")}
              </button>
            </span>
          ) : rejectedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
              <Clock className="size-3.5" />
              {t("rejectedPill", { count: rejectedCount })}
            </span>
          ) : !isOnline ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-2 py-0.5 text-warning-foreground">
              <WifiOff className="size-3.5" />
              {t("offlinePill", { count: pendingChangeCount })}
            </span>
          ) : showSavingIndicator ? (
            <span className="flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" />
              {t("saving")}
            </span>
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
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="sales-search"
            autoComplete="off"
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearch("");
            }}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-7 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1 text-[0.65rem] text-muted-foreground">
            /
          </kbd>
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
        <ShowFilterMenu
          onlyWithSales={showOnlyWithSales}
          onChange={setShowOnlyWithSales}
          prefixLabel={`${t("showFilterLabel")}: `}
          allLabel={t("showFilterAll")}
          onlyWithSalesLabel={t("showOnlyWithSales")}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={splitMode}
            onChange={(event) => setSplitMode(event.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          {t("splitPaymentMethod")}
        </label>
        <div className="flex-1" />
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="font-normal">
                <span className="text-muted-foreground">
                  {t("cashBoxLabel")} ·{" "}
                </span>
                <span className="font-semibold">
                  {formatDayShort(cashBoxDay, locale)} /{" "}
                  {formatMoney(cashBoxAmount, { currency, locale })}
                </span>
                <ChevronDown className="size-3.5" />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-96 p-4">
            {cashSummarySlot}
          </PopoverContent>
        </Popover>
      </div>

      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {t("searchSummary", {
            categoryCount: matchedCategoryCount,
            productCount: visibleProducts.length,
          })}
        </p>
      )}

      <div
        ref={scrollRef}
        role="table"
        className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-border"
      >
        <div style={{ width: gridWidth, minWidth: "100%" }}>
          <div
            role="row"
            className="sticky top-0 z-20 grid border-b border-border bg-card"
            style={{ gridTemplateColumns }}
          >
            <div
              role="columnheader"
              className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-medium text-muted-foreground"
            >
              {t("productColumn")}
            </div>
            {view === "day" ? (
              <>
                <div
                  role="columnheader"
                  className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                  {t("stockNowColumn")}
                </div>
                <div
                  role="columnheader"
                  className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                  {t("priceColumn")}
                </div>
                {splitMode ? (
                  <>
                    <div
                      role="columnheader"
                      className="px-2 py-2 text-center text-sm font-medium text-muted-foreground"
                    >
                      {t("cashLabel")}
                    </div>
                    <div
                      role="columnheader"
                      className="px-2 py-2 text-center text-sm font-medium text-muted-foreground"
                    >
                      {t("cardLabel")}
                    </div>
                  </>
                ) : (
                  <div
                    role="columnheader"
                    className="px-2 py-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {t("quantityLabel")}
                  </div>
                )}
                <div
                  role="columnheader"
                  className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                  {t("sumColumn", {
                    currency: currencyLabel(currency, locale),
                  })}
                </div>
              </>
            ) : (
              <>
                <div
                  role="columnheader"
                  className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                  {t("stockAtStartColumn")}
                </div>
                {days.map((day) => (
                  <div
                    key={day}
                    role="columnheader"
                    style={splitMode ? { gridColumn: "span 2" } : undefined}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-xs font-medium",
                      isWeekend(day) && "bg-muted/60",
                      day === today && "bg-accent/40",
                    )}
                  >
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-foreground",
                        day === today && "bg-success/20 font-semibold",
                      )}
                    >
                      {formatWeekdayShort(day, locale)}
                    </span>
                    <span className="text-muted-foreground">
                      {view === "week"
                        ? shortDayMonth(day, locale)
                        : new Intl.DateTimeFormat(locale, {
                            day: "numeric",
                            timeZone: "UTC",
                          }).format(new Date(`${day}T00:00:00Z`))}
                    </span>
                    {splitMode && (
                      <span className="flex w-full text-[0.6rem] text-muted-foreground/70">
                        <span className="flex-1">{t("cashShort")}</span>
                        <span className="flex-1">{t("cardShort")}</span>
                      </span>
                    )}
                  </div>
                ))}
                <div
                  role="columnheader"
                  className="px-2 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                  {t("stockNowColumn")}
                </div>
              </>
            )}
          </div>

          <div
            role="rowgroup"
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = flatRows[virtualRow.index];
              const rowStyle: React.CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              };
              // Product rows render as a CSS grid whose columns must line up with the header's —
              // without repeating `gridTemplateColumns` here, a bare `grid` row falls back to a
              // single implicit column and every cell stacks instead of aligning.
              const productRowStyle: React.CSSProperties = {
                ...rowStyle,
                display: "grid",
                gridTemplateColumns,
              };

              if (row.kind === "category") {
                return (
                  <div
                    key={`category-${row.category.id}`}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    role="row"
                    style={rowStyle}
                    className="border-b border-border bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(row.category.id)}
                      aria-expanded={!row.collapsed}
                      className="sticky left-0 flex w-full items-center gap-2 bg-muted px-3 py-1.5 text-left text-sm font-semibold text-foreground hover:bg-muted/70"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground transition-transform",
                          row.collapsed && "-rotate-90",
                        )}
                      />
                      {row.category.label}
                      <span className="font-normal text-muted-foreground">
                        {t("categoryItemCount", { count: row.count })}
                      </span>
                      {row.collapsed && row.hasSales && (
                        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-normal text-muted-foreground">
                          <span className="size-1.5 rounded-full bg-success" />
                          {t("hasSalesInPeriod")}
                        </span>
                      )}
                    </button>
                  </div>
                );
              }

              if (row.kind === "subcategory") {
                return (
                  <div
                    key={`subcategory-${row.category.id}`}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    role="row"
                    style={rowStyle}
                    className="border-b border-border bg-muted/50"
                  >
                    <div className="sticky left-0 flex items-center gap-2 bg-muted/50 py-1 pr-3 pl-7 text-sm font-semibold text-foreground">
                      {row.category.label}
                      <span className="font-normal text-muted-foreground">
                        {t("categoryItemCount", { count: row.count })}
                      </span>
                    </div>
                  </div>
                );
              }

              const product = row.product;
              const price = salePriceMap.get(product.id) ?? null;
              const quantity = rowTotal(product.id);
              const dayDisabled = view === "day" && isFutureDay(period);

              return (
                <div
                  key={`product-${product.id}`}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  role="row"
                  style={productRowStyle}
                  className="group border-b border-border bg-card hover:bg-accent/20"
                >
                  <div
                    role="cell"
                    className="sticky left-0 z-[1] flex flex-col justify-center gap-0 bg-card px-3 py-1.5 group-hover:bg-accent/20"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                      <span className="truncate" title={product.name}>
                        {product.name}
                      </span>
                      <ProductNotesPopover
                        productId={product.id}
                        productName={product.name}
                        month={noteMonth}
                        notes={notesByProduct.get(product.id) ?? []}
                        noteTypes={noteTypes}
                      />
                    </span>
                    {product.sku && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {view === "day"
                          ? product.sku
                          : price !== null
                            ? `${product.sku} · ${formatMoneyBare(price, { locale })} ${currencyLabel(currency, locale)}`
                            : product.sku}
                      </span>
                    )}
                  </div>

                  {view === "day" ? (
                    <>
                      <div
                        role="cell"
                        className="flex items-center justify-end px-2 py-1.5"
                      >
                        <StockQuantity
                          value={stockNowMap.get(product.id) ?? 0}
                        />
                      </div>
                      <div
                        role="cell"
                        className="flex items-center justify-end px-2 py-1.5 text-muted-foreground"
                      >
                        {price !== null
                          ? formatMoneyBare(price, { locale })
                          : "—"}
                      </div>
                      {splitMode ? (
                        <>
                          <div
                            role="cell"
                            className="flex items-center justify-center px-1 py-1"
                          >
                            <input
                              name={cellKey(product.id, period, "cash")}
                              autoComplete="off"
                              aria-label={t("cashLabel")}
                              placeholder="·"
                              disabled={dayDisabled}
                              className={cn(inputBaseClass, "h-7 w-14")}
                              value={getValue(product.id, period, "cash") || ""}
                              onChange={(event) =>
                                setValue(
                                  product.id,
                                  period,
                                  "cash",
                                  Number.parseInt(event.target.value, 10) || 0,
                                )
                              }
                            />
                          </div>
                          <div
                            role="cell"
                            className="flex items-center justify-center px-1 py-1"
                          >
                            <input
                              name={cellKey(product.id, period, "card")}
                              autoComplete="off"
                              aria-label={t("cardLabel")}
                              placeholder="·"
                              disabled={dayDisabled}
                              className={cn(
                                inputBaseClass,
                                cardInputClass,
                                "h-7 w-14",
                              )}
                              value={getValue(product.id, period, "card") || ""}
                              onChange={(event) =>
                                setValue(
                                  product.id,
                                  period,
                                  "card",
                                  Number.parseInt(event.target.value, 10) || 0,
                                )
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <div
                          role="cell"
                          className="flex items-center justify-center px-1 py-1"
                        >
                          <input
                            name={cellKey(product.id, period, "none")}
                            autoComplete="off"
                            aria-label={t("quantityLabel")}
                            placeholder="·"
                            disabled={dayDisabled}
                            className={cn(inputBaseClass, "h-7 w-16")}
                            value={getValue(product.id, period, "none") || ""}
                            onChange={(event) =>
                              setValue(
                                product.id,
                                period,
                                "none",
                                Number.parseInt(event.target.value, 10) || 0,
                              )
                            }
                          />
                        </div>
                      )}
                      <div
                        role="cell"
                        className="flex items-center justify-end px-2 py-1.5 font-medium text-foreground"
                      >
                        {price !== null && quantity > 0
                          ? formatMoneyBare(price * quantity, { locale })
                          : "—"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        role="cell"
                        className="flex items-center justify-end px-2 py-1.5"
                      >
                        <StockQuantity
                          value={stockAtStartMap.get(product.id) ?? 0}
                        />
                      </div>
                      {days.map((day) => {
                        const disabled = isFutureDay(day);
                        return splitMode ? (
                          <Fragment key={day}>
                            <div
                              role="cell"
                              className={cn(
                                "flex items-center justify-center px-0.5 py-1",
                                isWeekend(day) && "bg-muted/30",
                              )}
                            >
                              <input
                                name={cellKey(product.id, day, "cash")}
                                autoComplete="off"
                                aria-label={t("cashLabel")}
                                placeholder="·"
                                disabled={disabled}
                                className={cn(
                                  inputBaseClass,
                                  "h-6 w-full max-w-10",
                                )}
                                value={getValue(product.id, day, "cash") || ""}
                                onChange={(event) =>
                                  setValue(
                                    product.id,
                                    day,
                                    "cash",
                                    Number.parseInt(event.target.value, 10) ||
                                      0,
                                  )
                                }
                              />
                            </div>
                            <div
                              role="cell"
                              className={cn(
                                "flex items-center justify-center px-0.5 py-1",
                                isWeekend(day) && "bg-muted/30",
                              )}
                            >
                              <input
                                name={cellKey(product.id, day, "card")}
                                autoComplete="off"
                                aria-label={t("cardLabel")}
                                placeholder="·"
                                disabled={disabled}
                                className={cn(
                                  inputBaseClass,
                                  cardInputClass,
                                  "h-6 w-full max-w-10",
                                )}
                                value={getValue(product.id, day, "card") || ""}
                                onChange={(event) =>
                                  setValue(
                                    product.id,
                                    day,
                                    "card",
                                    Number.parseInt(event.target.value, 10) ||
                                      0,
                                  )
                                }
                              />
                            </div>
                          </Fragment>
                        ) : (
                          <div
                            key={day}
                            role="cell"
                            className={cn(
                              "flex items-center justify-center px-1 py-1",
                              isWeekend(day) && "bg-muted/30",
                            )}
                          >
                            <input
                              name={cellKey(product.id, day, "none")}
                              autoComplete="off"
                              aria-label={t("quantityLabel")}
                              placeholder="·"
                              disabled={disabled}
                              className={cn(
                                inputBaseClass,
                                "h-6 w-full max-w-11",
                              )}
                              value={getValue(product.id, day, "none") || ""}
                              onChange={(event) =>
                                setValue(
                                  product.id,
                                  day,
                                  "none",
                                  Number.parseInt(event.target.value, 10) || 0,
                                )
                              }
                            />
                          </div>
                        );
                      })}
                      <div
                        role="cell"
                        className="flex items-center justify-end px-2 py-1.5"
                      >
                        <StockQuantity
                          value={stockNowMap.get(product.id) ?? 0}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {flatRows.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("noMatches")}
          </p>
        )}

        {categoriesBelowCount > 0 && (
          <div className="sticky bottom-0 left-0 z-20 border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            {t("moreCategoriesHint", { count: categoriesBelowCount })}
          </div>
        )}
      </div>

      {saveError && <Badge variant="destructive">{t("noPriceError")}</Badge>}
    </div>
  );
}
