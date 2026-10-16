"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const SECTIONS = [
  "shop",
  "accounting",
  "sales",
  "restock",
  "users",
  "account",
] as const;
type Section = (typeof SECTIONS)[number];

export function SettingsNav({
  shop,
  accounting,
  sales,
  restock,
  users,
  account,
  initialSection,
}: Record<Section, ReactNode> & { initialSection?: Section }) {
  const t = useTranslations("settings");
  const [active, setActive] = useState<Section>(initialSection ?? "shop");

  const content: Record<Section, ReactNode> = {
    shop,
    accounting,
    sales,
    restock,
    users,
    account,
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
        {SECTIONS.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActive(section)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap",
              active === section
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(`nav.${section}`)}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{content[active]}</div>
    </div>
  );
}
