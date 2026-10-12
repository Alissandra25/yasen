CREATE TYPE "stock_adjustment_reason" AS ENUM('breakage', 'shortage', 'mis_sort', 'other');--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"old_quantity" integer NOT NULL,
	"new_quantity" integer NOT NULL,
	"reason" "stock_adjustment_reason" NOT NULL,
	"adjusted_by" integer NOT NULL,
	"adjusted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stock_adjustments_product_id_idx" ON "stock_adjustments" ("product_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_location_id_idx" ON "stock_adjustments" ("location_id");--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_adjusted_by_users_id_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "users"("id");