"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { businessToday, dateOnlySchema } from "@/lib/dates";
import { moneyInputSchema, parseMoney } from "@/lib/money";
import { recordAuditEntry } from "@/server/audit";
import { getCurrentBusiness } from "@/server/services/business";
import { postPurchase } from "@/server/services/purchases";
import { requireOwner } from "@/server/session";

const PRODUCTS_PAGE = "/[locale]/(app)/products";
const RECEIPTS_PAGE = "/[locale]/(app)/receipts";

// Raw text crosses the client->server boundary unparsed (the project's money rule): the client
// never pre-parses purchasePrice/salePrice itself, this schema validates/parses them here.
const purchaseLineActionSchema = z
  .object({
    productId: z.number().int().positive().nullable(),
    newProductName: z.string().trim().max(255).nullable(),
    newProductCategoryId: z.number().int().positive().nullable(),
    newProductSku: z.string().trim().max(100).nullable(),
    locationId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    purchasePriceRaw: moneyInputSchema,
    salePriceRaw: z.string().nullable(),
  })
  .refine(
    (line) =>
      line.productId !== null ||
      (!!line.newProductName && line.newProductCategoryId !== null),
    {
      message:
        "A line needs either an existing product or a new product's name and category together.",
    },
  );

const postPurchaseActionInputSchema = z
  .object({
    supplierId: z.number().int().positive().nullable(),
    newSupplierName: z.string().trim().max(255).nullable(),
    defaultLocationId: z.number().int().positive(),
    // "Дата надходження" (spec 3.3): when the goods arrived / prices take effect. Optional for
    // backward compatibility — falls back to today, same as before this field existed.
    receivedDate: dateOnlySchema.nullable().optional(),
    lines: z.array(purchaseLineActionSchema).min(1),
  })
  .refine((input) => input.supplierId !== null || !!input.newSupplierName, {
    message: "Either an existing supplier or a new supplier name is required.",
  });

export type PostPurchaseActionInput = z.input<
  typeof postPurchaseActionInputSchema
>;

export interface PostPurchaseActionResult {
  ok: boolean;
  error?: "invalid_input";
  purchaseId?: number;
}

export async function postPurchaseAction(
  input: PostPurchaseActionInput,
): Promise<PostPurchaseActionResult> {
  const user = await requireOwner();

  const parsed = postPurchaseActionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const salePricesValid = parsed.data.lines.every(
    (line) =>
      line.salePriceRaw === null ||
      line.salePriceRaw === "" ||
      moneyInputSchema.safeParse(line.salePriceRaw).success,
  );
  if (!salePricesValid) return { ok: false, error: "invalid_input" };

  const business = await getCurrentBusiness();
  const effectiveFrom =
    parsed.data.receivedDate ??
    businessToday(business?.timezone ?? "Europe/Kyiv");

  const lines = parsed.data.lines.map((line) => ({
    productId: line.productId,
    newProductName: line.newProductName,
    newProductCategoryId: line.newProductCategoryId,
    newProductSku: line.newProductSku,
    locationId: line.locationId,
    quantity: line.quantity,
    purchasePrice: parseMoney(line.purchasePriceRaw),
    salePrice:
      line.salePriceRaw === null || line.salePriceRaw === ""
        ? null
        : parseMoney(line.salePriceRaw),
  }));

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const { purchase } = await postPurchase(
      tx,
      user.businessId,
      user.id,
      effectiveFrom,
      {
        supplierId: parsed.data.supplierId,
        newSupplierName: parsed.data.newSupplierName,
        defaultLocationId: parsed.data.defaultLocationId,
        lines,
      },
    );
    await recordAuditEntry(tx, {
      businessId: user.businessId,
      userId: user.id,
      actionType: "purchase.post",
      entityType: "purchase",
      entityId: purchase.id,
      newValue: { supplierId: purchase.supplierId, lineCount: lines.length },
    });
    return purchase;
  });

  revalidatePath(PRODUCTS_PAGE, "page");
  revalidatePath(RECEIPTS_PAGE, "page");
  return { ok: true, purchaseId: result.id };
}
