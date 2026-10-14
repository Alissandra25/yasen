"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createNoteTypeAction,
  updateNoteTypeAction,
  type NoteTypeFormState,
} from "@/server/actions/note-types";

interface NoteType {
  id: number;
  name: string;
  color: string;
}

const initialState: NoteTypeFormState = {};

function NoteTypeRow({ noteType }: { noteType: NoteType }) {
  const t = useTranslations("noteTypes");
  const [editing, setEditing] = useState(false);
  const boundAction = updateNoteTypeAction.bind(null, noteType.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setEditing(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  if (!editing) {
    return (
      <li className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: noteType.color }}
        />
        <span className="flex-1 text-sm font-medium text-foreground">
          {noteType.name}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          {t("change")}
        </Button>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-background px-3 py-2">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input
          type="color"
          name="color"
          defaultValue={noteType.color}
          aria-label={t("colorLabel")}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
        />
        <Input
          name="name"
          defaultValue={noteType.name}
          required
          className="max-w-40"
        />
        {state.error && (
          <span className="text-xs text-destructive" role="alert">
            {t("invalidInput")}
          </span>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(false)}
        >
          {t("cancel")}
        </Button>
      </form>
    </li>
  );
}

const DEFAULT_COLOR = "#3B82F6";

function AddNoteTypeForm() {
  const t = useTranslations("noteTypes");
  const [state, formAction, isPending] = useActionState(
    createNoteTypeAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input
        type="color"
        name="color"
        defaultValue={DEFAULT_COLOR}
        aria-label={t("colorLabel")}
        className="h-8 w-10 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
      />
      <Input
        name="name"
        placeholder={t("nameLabel")}
        required
        className="h-8 max-w-40"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {t("addType")}
      </Button>
      {state.error && (
        <span className="text-xs text-destructive" role="alert">
          {t("invalidInput")}
        </span>
      )}
    </form>
  );
}

export function NoteTypeManager({ noteTypes }: { noteTypes: NoteType[] }) {
  const t = useTranslations("noteTypes");

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {noteTypes.map((noteType) => (
          <NoteTypeRow key={noteType.id} noteType={noteType} />
        ))}
        {noteTypes.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {t("empty")}
          </li>
        )}
      </ul>
      <AddNoteTypeForm />
    </div>
  );
}
