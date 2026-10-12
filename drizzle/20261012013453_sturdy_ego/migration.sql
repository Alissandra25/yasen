CREATE TYPE "payment_method" AS ENUM('cash', 'card');--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"sold_by" integer NOT NULL,
	"sale_date" date NOT NULL,
	"unit_price" integer NOT NULL,
	"unit_cost" integer NOT NULL,
	"payment_method" "payment_method",
	"client_uuid" varchar(36) UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sales_product_id_idx" ON "sales" ("product_id");--> statement-breakpoint
CREATE INDEX "sales_location_id_idx" ON "sales" ("location_id");--> statement-breakpoint
CREATE INDEX "sales_sale_date_idx" ON "sales" ("sale_date");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_users_id_fkey" FOREIGN KEY ("sold_by") REFERENCES "users"("id");