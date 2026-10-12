CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY,
	"purchase_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"purchase_price" integer NOT NULL,
	"sale_price" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"default_location_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items" ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_items_product_id_idx" ON "purchase_items" ("product_id");--> statement-breakpoint
CREATE INDEX "purchases_business_id_idx" ON "purchases" ("business_id");--> statement-breakpoint
CREATE INDEX "purchases_supplier_id_idx" ON "purchases" ("supplier_id");--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id");--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_default_location_id_locations_id_fkey" FOREIGN KEY ("default_location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");