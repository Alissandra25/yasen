"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

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
    <Button
      variant="outline"
      size="icon"
      aria-label={t("toggleLabel")}
      onClick={cycleTheme}
    >
      <Icon />
    </Button>
  );
}
