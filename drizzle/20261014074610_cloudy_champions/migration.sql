CREATE TYPE "stocktake_status" AS ENUM('draft', 'posted');--> statement-breakpoint
CREATE TABLE "stocktake_items" (
	"id" serial PRIMARY KEY,
	"stocktake_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"system_quantity" integer NOT NULL,
	"counted_quantity" integer,
	"reason" "stock_adjustment_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocktakes" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"status" "stocktake_status" DEFAULT 'draft'::"stocktake_status" NOT NULL,
	"created_by" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD COLUMN "stocktake_id" integer;--> statement-breakpoint
CREATE INDEX "stocktake_items_stocktake_id_idx" ON "stocktake_items" ("stocktake_id");--> statement-breakpoint
CREATE INDEX "stocktake_items_product_id_idx" ON "stocktake_items" ("product_id");--> statement-breakpoint
CREATE INDEX "stocktakes_business_id_idx" ON "stocktakes" ("business_id");--> statement-breakpoint
CREATE INDEX "stocktakes_location_id_idx" ON "stocktakes" ("location_id");--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stocktake_id_stocktakes_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id");--> statement-breakpoint
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_stocktake_id_stocktakes_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id");--> statement-breakpoint
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");--> statement-breakpoint
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");