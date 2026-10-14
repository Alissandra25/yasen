"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export type ImportResolution = "merge" | "overwrite" | "keep";

const RESOLUTIONS: ImportResolution[] = ["merge", "overwrite", "keep"];

/**
 * The merge/overwrite/keep picker + "apply to all" bulk action (spec 3.2), shared between
 * suppliers and products import — the only thing that differs between the two is what a
 * conflict's csvRow looks like, which stays with each entity's own action, not here.
 */
export function ImportConflictResolver({
  conflicts,
  onSubmitAction,
}: {
  conflicts: { id: number; label: string }[];
  onSubmitAction: (resolutions: Record<number, ImportResolution>) => Promise<void>;
}) {
  const t = useTranslations("csvImport");
  const [resolutions, setResolutions] = useState<
    Record<number, ImportResolution>
  >({});
  const [submitted, setSubmitted] = useState(false);

  function setAll(resolution: ImportResolution) {
    setResolutions(
      Object.fromEntries(
        conflicts.map((conflict) => [conflict.id, resolution]),
      ),
    );
  }

  function setOne(id: number, resolution: ImportResolution) {
    setResolutions((prev) => ({ ...prev, [id]: resolution }));
  }

  async function handleSubmit() {
    await onSubmitAction(
      Object.fromEntries(
        conflicts.map((conflict) => [
          conflict.id,
          resolutions[conflict.id] ?? "keep",
        ]),
      ),
    );
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">{t("resolutionsApplied")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("applyToAll")}</span>
        {RESOLUTIONS.map((option) => (
          <Button
            key={option}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAll(option)}
          >
            {t(option)}
          </Button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {conflicts.map((conflict) => (
          <li
            key={conflict.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2"
          >
            <span className="text-sm text-foreground">{conflict.label}</span>
            <div className="flex items-center gap-3">
              {RESOLUTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                >
                  <input
                    type="radio"
                    name={`resolution-${conflict.id}`}
                    checked={(resolutions[conflict.id] ?? "keep") === option}
                    onChange={() => setOne(conflict.id, option)}
                  />
                  {t(option)}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={() => void handleSubmit()}>
        {t("submitResolutions")}
      </Button>
    </div>
  );
}
