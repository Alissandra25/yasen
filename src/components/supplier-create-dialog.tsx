"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSupplierAction,
  type SupplierFormState,
} from "@/server/actions/suppliers";

const initialState: SupplierFormState = {};

export function SupplierCreateDialog() {
  const t = useTranslations("suppliers");
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createSupplierAction,
    initialState,
  );

  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (wasPendingRef.current && !isPending && !state.error) {
      setOpen(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            <Plus className="size-4" />
            {t("newSupplierButton")}
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("newSupplierButton")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-supplier-name">{t("nameLabel")}</Label>
              <Input id="create-supplier-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-supplier-contacts">
                {t("contactsLabel")}
              </Label>
              <Input id="create-supplier-contacts" name="contacts" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-supplier-note">{t("noteLabel")}</Label>
              <Input id="create-supplier-note" name="note" />
            </div>
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {t("invalidInput")}
            </p>
          )}
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  {t("cancel")}
                </Button>
              }
            />
            <Button type="submit" disabled={isPending}>
              {t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
