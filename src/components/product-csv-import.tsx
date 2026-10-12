"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  ImportConflictResolver,
  type ImportResolution,
} from "@/components/import-conflict-resolver";
import {
  importProductsCsvAction,
  resolveProductImportConflictsAction,
  type ProductImportState,
} from "@/server/actions/products";

const initialState: ProductImportState = {};

export function ProductCsvImport() {
  const t = useTranslations("productsImport");
  const [state, formAction, isPending] = useActionState(
    importProductsCsvAction,
    initialState,
  );
  const conflicts = state.conflicts ?? [];
  const rowErrors = state.rowErrors ?? [];

  async function submitResolutions(
    resolutions: Record<number, ImportResolution>,
  ) {
    await resolveProductImportConflictsAction(
      conflicts.map((conflict) => ({
        existingId: conflict.existingId,
        resolution: resolutions[conflict.existingId] ?? "keep",
        csvRow: conflict.csvRow,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input
          type="file"
          name="file"
          accept=".csv"
          required
          className="text-sm text-foreground"
        />
        <Button type="submit" disabled={isPending}>
          {t("upload")}
        </Button>
        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {t(state.error === "parse_error" ? "parseError" : "invalidInput")}
          </p>
        )}
      </form>

      {state.createdCount !== undefined && (
        <p className="text-sm text-muted-foreground">
          {t("createdCount", { count: state.createdCount })}
        </p>
      )}

      {rowErrors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-sm font-medium text-destructive">
            {t("rowErrorsTitle")}
          </p>
          <ul className="flex flex-col gap-1">
            {rowErrors.map((rowError, index) => (
              <li key={index} className="text-sm text-destructive">
                {rowError.name} —{" "}
                {t(
                  rowError.reason === "unknown_category"
                    ? "unknownCategory"
                    : "invalidPrice",
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflicts.length > 0 && (
        <ImportConflictResolver
          conflicts={conflicts.map((conflict) => ({
            id: conflict.existingId,
            label: conflict.existingName,
          }))}
          onSubmit={submitResolutions}
        />
      )}
    </div>
  );
}
