import { cn } from "@/lib/utils";

// Raw brand swatches (globals.css: "reserved for dots, badges...") — warehouse keeps the
// brand's primary green, shop its accent orange, consistent everywhere a location's type needs
// a quick visual tag (receipts, transfers, stock, locations).
const LOCATION_TYPE_CLASS: Record<"warehouse" | "shop", string> = {
  warehouse: "bg-brand-primary",
  shop: "bg-brand-accent",
};

export function locationTypeColorClass(type: "warehouse" | "shop"): string {
  return LOCATION_TYPE_CLASS[type];
}

/** Small coloured square tagging a location's type (spec mockups: warehouse green, shop orange). */
export function LocationDot({
  type,
  className,
}: {
  type: "warehouse" | "shop";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-[2px]",
        LOCATION_TYPE_CLASS[type],
        className,
      )}
    />
  );
}
