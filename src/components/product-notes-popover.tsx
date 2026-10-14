"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { monthStartDate } from "@/lib/dates";
import {
  createProductNoteAction,
  deleteProductNoteAction,
  updateProductNoteAction,
  type ProductNoteFormState,
} from "@/server/actions/product-notes";
import type { ActiveProductNote } from "@/server/services/product-notes";

interface NoteTypeOption {
  id: number;
  name: string;
  color: string;
}

const initialState: ProductNoteFormState = {};

function NoteForm({
  productId,
  month,
  noteTypes,
  note,
  onCancel,
  formAction,
}: {
  productId: number;
  month: string;
  noteTypes: NoteTypeOption[];
  note?: ActiveProductNote;
  onCancel?: () => void;
  formAction: (
    state: ProductNoteFormState,
    formData: FormData,
  ) => Promise<ProductNoteFormState>;
}) {
  const t = useTranslations("productNotes");
  const [state, action, isPending] = useActionState(formAction, initialState);

  return (
    <form
      action={action}
      className="flex flex-col gap-2 rounded-lg border border-border p-2.5"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="validFrom" value={note?.validFrom ?? month} />
      <select
        name="noteTypeId"
        defaultValue={note?.noteTypeId}
        required
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {noteTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>
      <textarea
        name="text"
        defaultValue={note?.text}
        required
        rows={2}
        className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="carriesOver"
          defaultChecked={note?.carriesOver ?? false}
          className="size-4 rounded border-input accent-primary"
        />
        {t("carriesOverLabel")}
      </label>
      {state.error && (
        <p className="text-xs text-destructive" role="alert">
          {t("invalidInput")}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {t("save")}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

function NoteItem({
  note,
  month,
  noteTypes,
}: {
  note: ActiveProductNote;
  month: string;
  noteTypes: NoteTypeOption[];
}) {
  const t = useTranslations("productNotes");
  const roleT = useTranslations("roles");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateProductNoteAction.bind(null, note.id);

  if (editing) {
    return (
      <NoteForm
        productId={note.productId}
        month={month}
        noteTypes={noteTypes}
        note={note}
        onCancel={() => setEditing(false)}
        formAction={boundUpdate}
      />
    );
  }

  const authorDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(note.createdAt);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: note.noteTypeColor }}
          />
          {note.noteTypeName}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("edit")}
        </button>
      </div>
      <p className="text-sm text-foreground">{note.text}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-normal">
            {note.carriesOver ? t("carriesOverBadge") : t("monthOnlyBadge")}
          </Badge>
          {roleT(note.createdByRole)}, {authorDate}
        </span>
        <button
          type="button"
          aria-label={t("delete")}
          onClick={() => void deleteProductNoteAction(note.id, note.productId)}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ProductNotesPopover({
  productId,
  productName,
  month,
  notes,
  noteTypes,
}: {
  productId: number;
  productName: string;
  month: string;
  notes: ActiveProductNote[];
  noteTypes: NoteTypeOption[];
}) {
  const t = useTranslations("productNotes");
  const locale = useLocale();
  const [adding, setAdding] = useState(false);

  if (noteTypes.length === 0) {
    // No note types configured yet (settings) — nothing to attach a note to.
    return null;
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(`${monthStartDate(month)}T00:00:00Z`),
  );

  return (
    <Popover onOpenChange={(open) => !open && setAdding(false)}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("triggerLabel", {
              count: notes.length,
              product: productName,
            })}
            className="inline-flex items-center gap-0.5 rounded-full px-0.5 align-middle"
          >
            {notes.length > 0 ? (
              notes.map((note) => (
                <span
                  key={note.id}
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: note.noteTypeColor }}
                />
              ))
            ) : (
              <span
                aria-hidden="true"
                className="size-2 rounded-full border border-dashed border-muted-foreground/50"
              />
            )}
          </button>
        }
      />
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-2.5">
        <div className="flex items-start justify-between gap-2 px-0.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
              {t("header", { month: monthLabel })}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {productName}
            </span>
          </div>
          <PopoverClose
            aria-label={t("close")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </PopoverClose>
        </div>
        {notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            month={month}
            noteTypes={noteTypes}
          />
        ))}
        {adding ? (
          <NoteForm
            productId={productId}
            month={month}
            noteTypes={noteTypes}
            onCancel={() => setAdding(false)}
            formAction={createProductNoteAction}
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3.5" />
              {t("addNote")}
            </Button>
            <Link
              href={`/${locale}/settings`}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t("settingsHint")}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
