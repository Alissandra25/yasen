// One-off: loads this shop's prepared logo files (mark/lockup x light/dark) into
// business_logo_assets — see src/server/services/logo.ts for how they're resolved and used.
// Not part of the fresh-install seed (scripts/seed.mts): the source files live on this
// developer's machine, not in the repo, until stage 4's upload UI replaces this script entirely.
// Usage: npm run db:seed-logo -- [path-to-folder]   (defaults to ~/Downloads/yasen-logo)
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getDb } from "@/db/client";
import { businessesTable } from "@/db/schema/businesses";
import { businessLogoAssetsTable } from "@/db/schema/business-logo-assets";

const dir = process.argv[2] ?? join(homedir(), "Downloads", "yasen-logo");

// Stored as PNG uniformly (spec 13.5's accepted formats), even though some of these also exist
// as SVG: a future PDF document can't render SVG (react-pdf doesn't accept it), and keeping one
// format here means the resolver and its consumers never need to branch on mime type.
const ASSETS: Array<{
  slot: "mark" | "lockup";
  theme: "light" | "dark";
  file: string;
}> = [
  { slot: "lockup", theme: "light", file: "yasen-logo-light.png" },
  { slot: "lockup", theme: "dark", file: "yasen-logo-dark.png" },
  { slot: "mark", theme: "light", file: "yasen-mark-light-512.png" },
  { slot: "mark", theme: "dark", file: "yasen-mark-dark-512.png" },
];

const db = getDb();
const [business] = await db.select().from(businessesTable).limit(1);
if (!business) {
  throw new Error("No business row yet — run `npm run db:seed` first.");
}

for (const { slot, theme, file } of ASSETS) {
  const image = await readFile(join(dir, file));
  await db
    .insert(businessLogoAssetsTable)
    .values({
      businessId: business.id,
      slot,
      theme,
      image,
      mimeType: "image/png",
    })
    .onConflictDoUpdate({
      target: [
        businessLogoAssetsTable.businessId,
        businessLogoAssetsTable.slot,
        businessLogoAssetsTable.theme,
      ],
      set: { image, mimeType: "image/png" },
    });
  console.log(`Seeded ${slot}/${theme} from ${file} (${image.byteLength} bytes)`);
}
