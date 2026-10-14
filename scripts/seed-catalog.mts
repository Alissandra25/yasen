// Dev-only catalogue seed: loads scripts/seed-data/ (categories, suppliers, ~1750 products with
// starting stock) into the single business created by scripts/seed.mts. Safe to re-run — every
// step skips rows that already exist (matched by category name within its parent, supplier name,
// or product name), like scripts/seed.mts and the CSV import services already do.
//
// Order follows scripts/seed-data/README.md: locations -> categories -> suppliers -> products
// (+ one price_history row each) -> opening stock as an audited stock adjustment per location.
// A rerun only seeds opening stock for products it creates in that run — an existing product's
// stock is left alone, since by then it may reflect real (simulated) usage, not the seed value.
//
// Quantities: products.csv carries a `unit` column and decimal stock for m/m2/kg products,
// anticipating products.unit/quantity.ts (not built yet — see docs/spec/technical.md 3.4). This
// script ignores `unit` and rounds decimal stock to the nearest whole unit, matching how every
// current reader/writer treats inventory.quantity (a plain integer).
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { businessToday } from "@/lib/dates";
import {
  moneyInputSchema,
  parseMoney,
  roundHalfAwayFromZero,
} from "@/lib/money";
import { normalizeName } from "@/lib/strings";
import { recordAuditEntry } from "@/server/audit";
import { getCurrentBusiness } from "@/server/services/business";
import { createCategory, listCategories } from "@/server/services/categories";
import { createLocation, listLocations } from "@/server/services/locations";
import { createProduct, listProducts } from "@/server/services/products";
import { adjustStock } from "@/server/services/stock-adjustments";
import { createSupplier, listSuppliers } from "@/server/services/suppliers";

const SEED_DATA_DIR = join(import.meta.dirname, "seed-data");

interface CategorySeed {
  name: string;
  subcategories: string[];
}

interface SupplierSeed {
  name: string;
  contacts?: string;
  note?: string;
}

interface ProductCsvRecord {
  name: string;
  sku: string;
  supplier: string;
  category: string;
  unit: string;
  minStock: string;
  purchasePrice: string;
  salePrice: string;
  stockWarehouse: string;
  stockShop: string;
}

const db = getDb();

const business = await getCurrentBusiness();
if (!business) {
  console.error("No business found — run `npm run db:seed` first.");
  process.exit(1);
}
const businessId = business.id;

const [owner] = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.businessId, businessId))
  .limit(1);
if (!owner) {
  console.error(
    "No user found for this business — run `npm run db:seed` with " +
      "OWNER_SEED_EMAIL/OWNER_SEED_PASSWORD set first (opening stock needs a user to attribute the adjustment to).",
  );
  process.exit(1);
}

const today = businessToday(business.timezone ?? "Europe/Kyiv");

// --- Locations («Склад» / «Магазин», spec 12.2) ------------------------------------------------

const existingLocations = await listLocations(businessId);
const locationIdByType = new Map(
  existingLocations.map((location) => [location.type, location.id]),
);

async function ensureLocation(name: string, type: "warehouse" | "shop") {
  const existing = locationIdByType.get(type);
  if (existing) return existing;
  const location = await createLocation(db, businessId, { name, type });
  console.log(`Created location: ${name} (${type})`);
  return location.id;
}

const warehouseId = await ensureLocation("Склад", "warehouse");
const shopId = await ensureLocation("Магазин", "shop");

// --- Categories ----------------------------------------------------------------------------

const categorySeed: CategorySeed[] = JSON.parse(
  await readFile(join(SEED_DATA_DIR, "categories.json"), "utf8"),
);

let categories = await listCategories(businessId);
const categoryIdByKey = new Map(
  categories.map((category) => [
    `${category.parentId ?? ""}:${normalizeName(category.name)}`,
    category.id,
  ]),
);

let createdCategories = 0;
for (const top of categorySeed) {
  const topKey = `:${normalizeName(top.name)}`;
  let topId = categoryIdByKey.get(topKey);
  if (!topId) {
    const category = await createCategory(db, businessId, {
      name: top.name,
      parentId: null,
    });
    topId = category.id;
    categoryIdByKey.set(topKey, topId);
    createdCategories++;
  }

  for (const subName of top.subcategories) {
    const subKey = `${topId}:${normalizeName(subName)}`;
    if (categoryIdByKey.has(subKey)) continue;
    const category = await createCategory(db, businessId, {
      name: subName,
      parentId: topId,
    });
    categoryIdByKey.set(subKey, category.id);
    createdCategories++;
  }
}

const totalCategorySeedCount =
  categorySeed.length +
  categorySeed.reduce((sum, top) => sum + top.subcategories.length, 0);
console.log(
  `Categories: ${createdCategories} created, ${totalCategorySeedCount - createdCategories} already present.`,
);

// products.csv's `category` column is always the most specific one — a subcategory name, unique
// across the whole tree (README) — so re-reading fresh and keying only on non-top-level rows is
// enough to resolve it, without needing to know which parent it belongs to.
categories = await listCategories(businessId);
const categoryIdBySubName = new Map<string, number>();
for (const category of categories) {
  if (category.parentId !== null) {
    categoryIdBySubName.set(normalizeName(category.name), category.id);
  }
}

// --- Suppliers -------------------------------------------------------------------------------

const supplierSeed: SupplierSeed[] = JSON.parse(
  await readFile(join(SEED_DATA_DIR, "suppliers.json"), "utf8"),
);

const existingSuppliers = await listSuppliers(businessId);
const supplierIdByName = new Map(
  existingSuppliers.map((supplier) => [
    normalizeName(supplier.name),
    supplier.id,
  ]),
);

let createdSuppliers = 0;
for (const seed of supplierSeed) {
  const key = normalizeName(seed.name);
  if (supplierIdByName.has(key)) continue;
  const supplier = await createSupplier(db, businessId, {
    name: seed.name,
    contacts: seed.contacts || null,
    note: seed.note || null,
  });
  supplierIdByName.set(key, supplier.id);
  createdSuppliers++;
}
console.log(
  `Suppliers: ${createdSuppliers} created, ${supplierSeed.length - createdSuppliers} already present.`,
);

// --- Products + opening stock ------------------------------------------------------------------

const csvText = await readFile(join(SEED_DATA_DIR, "products.csv"), "utf8");
const records: ProductCsvRecord[] = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const existingProducts = await listProducts(businessId);
const existingProductNames = new Set(
  existingProducts.map((product) => normalizeName(product.name)),
);

function roundQuantity(raw: string): number {
  const value = Number.parseFloat(raw.trim());
  return Number.isFinite(value) ? roundHalfAwayFromZero(value) : 0;
}

async function seedOpeningStock(
  productId: number,
  locationId: number,
  quantity: number,
) {
  if (quantity === 0) return; // inventory row already starts at 0 (createProduct)
  const result = await adjustStock(db, owner.id, {
    productId,
    locationId,
    newQuantity: quantity,
    reason: "other",
  });
  if (!result.ok) return;
  await recordAuditEntry(db, {
    businessId,
    userId: owner.id,
    actionType: "stock_adjustment.create",
    entityType: "stock_adjustment",
    entityId: result.adjustment.id,
    productId,
    oldValue: { quantity: result.adjustment.oldQuantity },
    newValue: { quantity: result.adjustment.newQuantity },
    reason: "Opening stock (dev catalogue seed)",
  });
}

let createdProducts = 0;
let skippedExisting = 0;
let skippedUnknownCategory = 0;
let skippedUnknownSupplier = 0;
let skippedInvalidPrice = 0;

for (const [index, record] of records.entries()) {
  const name = record.name.trim();
  if (!name) continue;

  if (existingProductNames.has(normalizeName(name))) {
    skippedExisting++;
    continue;
  }

  const categoryId = categoryIdBySubName.get(normalizeName(record.category));
  if (!categoryId) {
    console.warn(`Skipping "${name}": unknown category "${record.category}".`);
    skippedUnknownCategory++;
    continue;
  }

  const supplierName = record.supplier.trim();
  const supplierId = supplierName
    ? supplierIdByName.get(normalizeName(supplierName))
    : undefined;
  if (supplierName && !supplierId) {
    console.warn(`Skipping "${name}": unknown supplier "${supplierName}".`);
    skippedUnknownSupplier++;
    continue;
  }

  const purchasePriceRaw = record.purchasePrice.trim();
  const salePriceRaw = record.salePrice.trim();
  if (
    (purchasePriceRaw &&
      !moneyInputSchema.safeParse(purchasePriceRaw).success) ||
    (salePriceRaw && !moneyInputSchema.safeParse(salePriceRaw).success)
  ) {
    console.warn(`Skipping "${name}": invalid price.`);
    skippedInvalidPrice++;
    continue;
  }
  const purchasePrice = purchasePriceRaw ? parseMoney(purchasePriceRaw) : null;
  const salePrice = salePriceRaw ? parseMoney(salePriceRaw) : null;

  const minStockRaw = Number.parseInt(record.minStock.trim(), 10);
  const minStock =
    Number.isFinite(minStockRaw) && minStockRaw >= 0 ? minStockRaw : 0;

  const product = await createProduct(db, businessId, {
    name,
    sku: record.sku.trim() || null,
    categoryId,
    defaultSupplierId: supplierId ?? null,
    minStock,
    purchasePrice,
    salePrice,
    effectiveFrom: purchasePrice !== null ? today : null,
  });
  existingProductNames.add(normalizeName(name));
  createdProducts++;

  await seedOpeningStock(
    product.id,
    warehouseId,
    roundQuantity(record.stockWarehouse),
  );
  await seedOpeningStock(product.id, shopId, roundQuantity(record.stockShop));

  if (createdProducts % 200 === 0) {
    console.log(
      `Products: ${createdProducts} created so far (row ${index + 1}/${records.length})...`,
    );
  }
}

console.log(
  `Products: ${createdProducts} created, ${skippedExisting} already present, ` +
    `${skippedUnknownCategory} skipped (unknown category), ${skippedUnknownSupplier} skipped (unknown supplier), ` +
    `${skippedInvalidPrice} skipped (invalid price).`,
);

await db.$client.end();
