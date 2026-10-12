CREATE TABLE "transfer_items" (
	"id" serial PRIMARY KEY,
	"transfer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"from_location_id" integer NOT NULL,
	"to_location_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "transfer_items_transfer_id_idx" ON "transfer_items" ("transfer_id");--> statement-breakpoint
CREATE INDEX "transfer_items_product_id_idx" ON "transfer_items" ("product_id");--> statement-breakpoint
CREATE INDEX "transfers_business_id_idx" ON "transfers" ("business_id");--> statement-breakpoint
CREATE INDEX "transfers_from_location_id_idx" ON "transfers" ("from_location_id");--> statement-breakpoint
CREATE INDEX "transfers_to_location_id_idx" ON "transfers" ("to_location_id");--> statement-breakpoint
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transfer_id_transfers_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id");--> statement-breakpoint
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_location_id_locations_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_location_id_locations_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");