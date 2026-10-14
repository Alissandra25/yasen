"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LocationOption {
  id: number;
  name: string;
}

/**
 * Only wired on the Sales page today — it's the only screen that reads a `locationId` search
 * param (spec 3.5.1 nav note: the switcher only shows on location-scoped daily-ops pages).
 * Goods receipts and Transfers choose locations per-document instead, so this stays Sales-only
 * rather than rendering a control there that wouldn't do anything.
 */
export function LocationSwitcher({
  label,
  locations,
  locationId,
}: {
  label: string;
  locations: LocationOption[];
  locationId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("locationId", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={String(locationId)} onValueChange={handleChange}>
        <SelectTrigger className="h-10 w-full font-semibold" size="default">
          <SelectValue>
            {(value: string | null) =>
              locations.find((location) => String(location.id) === value)
                ?.name ?? value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {locations.map((location) => (
            <SelectItem key={location.id} value={String(location.id)}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
