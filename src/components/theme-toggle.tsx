"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const THEMES = ["light", "dark", "system"] as const;
const ICONS = { light: Sun, dark: Moon, system: Monitor };

const subscribeNever = () => () => {};

// next-themes only knows the real theme after the client mounts; before that, assume "system"
// so server and client render the same thing.
function useMounted() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current = mounted
    ? ((theme as (typeof THEMES)[number]) ?? "system")
    : "system";
  const Icon = ICONS[current];

  function cycleTheme() {
    setTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t("toggleLabel")}
            onClick={cycleTheme}
          >
            <Icon />
          </Button>
        }
      />
      <TooltipContent>{t(current)}</TooltipContent>
    </Tooltip>
  );
}

/** Three-way segmented control (Light / Dark / System) for the account settings page. */
export function ThemeSegmented() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted
    ? ((theme as (typeof THEMES)[number]) ?? "system")
    : "system";

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
      {THEMES.map((value) => {
        const Icon = ICONS[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              current === value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(value)}
          </button>
        );
      })}
    </div>
  );
}
