"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { startStocktakeAction } from "@/server/actions/stocktakes";

export function StartStocktakeButton({
  locale,
  locations,
}: {
  locale: string;
  locations: { id: number; name: string }[];
}) {
  const t = useTranslations("stocktake");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? 0);
  const [isPending, startTransition] = useTransition();

  if (locations.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <ClipboardList className="size-4" />
            {t("startButton")}
          </Button>
        }
      />
      <PopoverContent align="end" className="flex w-64 flex-col gap-3 p-3">
        <select
          value={locationId}
          onChange={(event) => setLocationId(Number(event.target.value))}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await startStocktakeAction(locale, locationId);
            })
          }
        >
          {t("startConfirm")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
