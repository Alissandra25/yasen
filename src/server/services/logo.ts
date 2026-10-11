import { eq } from "drizzle-orm";
import type { getDb } from "@/db/client";
import { businessLogoAssetsTable } from "@/db/schema/business-logo-assets";

type ReadableDbOrTx = Pick<ReturnType<typeof getDb>, "select">;

export type LogoSlot = "mark" | "lockup";
export type LogoTheme = "light" | "dark";

export interface StoredLogoAsset {
  slot: LogoSlot;
  theme: LogoTheme;
  image: Buffer;
  mimeType: string;
}

export interface ResolvedLogoAsset {
  image: Buffer;
  mimeType: string;
  // True when the stored asset isn't the exact (slot, theme) requested, so the caller must
  // transform it: crop a lockup down to a square mark, and/or put it on a light backing plate
  // because it's a light-themed asset standing in for a missing dark one (spec 13.5).
  needsCrop: boolean;
  needsBackingPlate: boolean;
}

/**
 * Picks the best available logo asset for (slot, theme), falling back when the exact one wasn't
 * uploaded. Ranked by closeness to the request: a same-theme crop (mark from lockup) beats a
 * same-slot theme substitution (light standing in for dark on a backing plate), which beats
 * needing both. A lockup never falls back to a mark — a cropped square can't become a wordmark
 * lockup — only across theme.
 *
 * This is the one place that knows the fallback order, so a business with a single uploaded
 * image (the common case) and a business with a full prepared set (mark/lockup x light/dark)
 * are resolved through the same function.
 */
export function pickLogoAsset(
  assets: StoredLogoAsset[],
  slot: LogoSlot,
  theme: LogoTheme,
): ResolvedLogoAsset | null {
  const find = (s: LogoSlot, t: LogoTheme) =>
    assets.find((a) => a.slot === s && a.theme === t);
  const otherTheme: LogoTheme = theme === "dark" ? "light" : "dark";
  const otherSlot: LogoSlot = slot === "mark" ? "lockup" : "mark";

  const candidates =
    slot === "mark"
      ? [
          {
            asset: find(slot, theme),
            needsCrop: false,
            needsBackingPlate: false,
          },
          {
            asset: find(otherSlot, theme),
            needsCrop: true,
            needsBackingPlate: false,
          },
          {
            asset: find(slot, otherTheme),
            needsCrop: false,
            needsBackingPlate: true,
          },
          {
            asset: find(otherSlot, otherTheme),
            needsCrop: true,
            needsBackingPlate: true,
          },
        ]
      : [
          {
            asset: find(slot, theme),
            needsCrop: false,
            needsBackingPlate: false,
          },
          {
            asset: find(slot, otherTheme),
            needsCrop: false,
            needsBackingPlate: true,
          },
        ];

  const match = candidates.find((c) => c.asset);
  if (!match?.asset) return null;

  return {
    image: match.asset.image,
    mimeType: match.asset.mimeType,
    needsCrop: match.needsCrop,
    needsBackingPlate: match.needsBackingPlate,
  };
}

async function findAllLogoAssets(
  db: ReadableDbOrTx,
  businessId: number,
): Promise<StoredLogoAsset[]> {
  const rows = await db
    .select({
      slot: businessLogoAssetsTable.slot,
      theme: businessLogoAssetsTable.theme,
      image: businessLogoAssetsTable.image,
      mimeType: businessLogoAssetsTable.mimeType,
    })
    .from(businessLogoAssetsTable)
    .where(eq(businessLogoAssetsTable.businessId, businessId));
  return rows;
}

/** Null means nothing was ever uploaded for this business — caller falls back to the static project default. */
export async function getLogoAsset(
  db: ReadableDbOrTx,
  businessId: number,
  slot: LogoSlot,
  theme: LogoTheme,
): Promise<ResolvedLogoAsset | null> {
  const assets = await findAllLogoAssets(db, businessId);
  return pickLogoAsset(assets, slot, theme);
}
