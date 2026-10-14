"use client";

import {
  ArrowLeftRight,
  BarChart3,
  FolderTree,
  LayoutGrid,
  Menu,
  PackagePlus,
  Settings,
  Tag,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LocationSwitcher } from "@/components/location-switcher";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <Badge
          variant="destructive"
          className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs"
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}

export function AppSidebarNav({
  locale,
  brandName,
  dailyLabel,
  referencesLabel,
  settingsLabel,
  logoutLabel,
  closeMenuLabel,
  salesLabel,
  receiptsLabel,
  transfersLabel,
  stockLabel,
  productsLabel,
  categoriesLabel,
  suppliersLabel,
  locationsLabel,
  locationSwitcherLabel,
  negativeStockCount,
  locations,
  defaultLocationId,
  userInitial,
  userRoleLabel,
}: {
  locale: string;
  brandName: string;
  dailyLabel: string;
  referencesLabel: string;
  settingsLabel: string;
  logoutLabel: string;
  closeMenuLabel: string;
  salesLabel: string;
  receiptsLabel: string;
  transfersLabel: string;
  stockLabel: string;
  productsLabel: string;
  categoriesLabel: string;
  suppliersLabel: string;
  locationsLabel: string;
  locationSwitcherLabel: string;
  negativeStockCount: number;
  locations: { id: number; name: string }[];
  defaultLocationId: number | null;
  userInitial: string;
  userRoleLabel: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const withLocale = (segment: string) => `/${locale}${segment}`;
  const locationIdParam = searchParams.get("locationId");
  const currentLocationId = locationIdParam
    ? Number(locationIdParam)
    : defaultLocationId;

  const dailyItems: NavItem[] = [
    {
      key: "sales",
      href: withLocale("/sales"),
      label: salesLabel,
      icon: LayoutGrid,
    },
    {
      key: "receipts",
      href: withLocale("/receipts"),
      label: receiptsLabel,
      icon: PackagePlus,
    },
    {
      key: "transfers",
      href: withLocale("/transfers"),
      label: transfersLabel,
      icon: ArrowLeftRight,
    },
  ];

  const stockItem: NavItem = {
    key: "stock",
    href: withLocale("/stock"),
    label: stockLabel,
    icon: BarChart3,
    badge: negativeStockCount,
  };

  const referenceItems: NavItem[] = [
    {
      key: "products",
      href: withLocale("/products"),
      label: productsLabel,
      icon: Tag,
    },
    {
      key: "categories",
      href: withLocale("/categories"),
      label: categoriesLabel,
      icon: FolderTree,
    },
    {
      key: "suppliers",
      href: withLocale("/suppliers"),
      label: suppliersLabel,
      icon: Truck,
    },
    {
      key: "locations",
      href: withLocale("/locations"),
      label: locationsLabel,
      icon: Warehouse,
    },
  ];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeMenu() {
    setOpen(false);
  }

  const showLocationSwitcher =
    pathname === withLocale("/sales") && currentLocationId !== null;

  const content = (
    <div className="flex h-full w-64 flex-col gap-4 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4">
      <Link
        href={withLocale("/")}
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 px-1 py-1"
      >
        <LogoMark className="size-7" />
        <span className="font-logo text-lg font-semibold tracking-tight text-sidebar-foreground">
          {brandName}
        </span>
      </Link>

      {showLocationSwitcher && currentLocationId !== null && (
        <LocationSwitcher
          label={locationSwitcherLabel}
          locations={locations}
          locationId={currentLocationId}
        />
      )}

      <nav className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {dailyLabel}
          </span>
          {dailyItems.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={isActive(item.href)}
              onNavigate={closeMenu}
            />
          ))}
        </div>

        <NavLink
          item={stockItem}
          active={isActive(stockItem.href)}
          onNavigate={closeMenu}
        />

        <div className="flex flex-col gap-1">
          <span className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {referencesLabel}
          </span>
          {referenceItems.map((item) => (
            <NavLink
              key={item.key}
              item={item}
              active={isActive(item.href)}
              onNavigate={closeMenu}
            />
          ))}
        </div>
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        <NavLink
          item={{
            key: "settings",
            href: withLocale("/settings"),
            label: settingsLabel,
            icon: Settings,
          }}
          active={isActive(withLocale("/settings"))}
          onNavigate={closeMenu}
        />
        <div className="flex items-center gap-2 rounded-lg px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {userInitial}
          </span>
          <span className="flex-1 truncate text-sm font-medium text-sidebar-foreground">
            {userRoleLabel}
          </span>
          <LocaleSwitcher compact />
          <ThemeToggle />
        </div>
        <form action={logoutAction.bind(null, locale)} className="px-1 pt-1">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            {logoutLabel}
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden shrink-0 md:block">{content}</div>
      <div className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-2.5 md:hidden">
        <Link href={withLocale("/")} className="flex items-center gap-2">
          <LogoMark className="size-6" />
          <span className="font-logo text-base font-semibold text-sidebar-foreground">
            {brandName}
          </span>
        </Link>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={open ? closeMenuLabel : dailyLabel}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={closeMenuLabel}
            className="absolute inset-0 bg-foreground/20"
            onClick={closeMenu}
          />
          <div className="absolute inset-y-0 left-0">{content}</div>
        </div>
      )}
    </>
  );
}
