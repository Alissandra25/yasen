import { cn } from "@/lib/utils";

/**
 * Placeholder for the real logo (spec 13.5's "pinnate leaf" mark) — final lockup files don't
 * exist in the repo yet (that's Stage 4, logo upload). A simple inline approximation: green
 * leaflet pairs along a stem, orange terminal leaflet, so the sidebar isn't bare until then.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      <path
        d="M12 21V8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="text-muted-foreground/60"
      />
      <ellipse
        cx="8.3"
        cy="16.2"
        rx="3.1"
        ry="1.7"
        transform="rotate(-38 8.3 16.2)"
        className="fill-brand-primary"
      />
      <ellipse
        cx="15.7"
        cy="16.2"
        rx="3.1"
        ry="1.7"
        transform="rotate(38 15.7 16.2)"
        className="fill-brand-primary"
      />
      <ellipse
        cx="8.3"
        cy="11.4"
        rx="2.7"
        ry="1.5"
        transform="rotate(-38 8.3 11.4)"
        className="fill-brand-primary"
      />
      <ellipse
        cx="15.7"
        cy="11.4"
        rx="2.7"
        ry="1.5"
        transform="rotate(38 15.7 11.4)"
        className="fill-brand-primary"
      />
      <ellipse
        cx="12"
        cy="6.4"
        rx="1.9"
        ry="3.2"
        className="fill-brand-accent"
      />
    </svg>
  );
}
