"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  ImportConflictResolver,
  type ImportResolution,
} from "@/components/import-conflict-resolver";
import {
  importSuppliersCsvAction,
  resolveSupplierImportConflictsAction,
  type SupplierImportState,
} from "@/server/actions/suppliers";

const initialState: SupplierImportState = {};

export function SupplierCsvImport() {
  const t = useTranslations("suppliersImport");
  const [state, formAction, isPending] = useActionState(
    importSuppliersCsvAction,
    initialState,
  );
  const conflicts = state.conflicts ?? [];

  async function submitResolutions(
    resolutions: Record<number, ImportResolution>,
  ) {
    await resolveSupplierImportConflictsAction(
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
